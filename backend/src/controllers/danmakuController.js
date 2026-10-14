// 讨论区与弹幕控制器
// 覆盖：课堂弹幕流（多来源聚合：live/checkin/emotion/survey/homework）、
//      发消息（匿名仅 live 且老师开启时学生匿名）、点赞/取消点赞、
//      老师控制：匿名开关、弹幕全局暂停、PPT 页码同步
const Course = require('../models/Course');
const CourseStudent = require('../models/CourseStudent');
const ClassSession = require('../models/ClassSession');
const User = require('../models/User');
const DanmakuMessage = require('../models/DanmakuMessage');
const DanmakuLike = require('../models/DanmakuLike');
const { Op } = require('sequelize');

// 课堂实时状态（内存，单进程开发环境；重启后由前端重新同步）
const classroomState = new Map(); // courseId -> { paused, currentPage, pausedBy }

function getState(courseId) {
  if (!classroomState.has(courseId)) {
    classroomState.set(courseId, { paused: false, currentPage: 1, pausedBy: null });
  }
  return classroomState.get(courseId);
}

async function isTeacherOrAdmin(course, userId, role) {
  return role === 'admin' || Number(course.teacher_id) === Number(userId);
}

async function isEnrolled(courseId, studentId) {
  const c = await CourseStudent.findOne({ where: { course_id: courseId, student_id: studentId } });
  return !!c;
}

const SOURCE_LABEL = { live: '实时', checkin: '签到', emotion: '反馈', survey: '调查', homework: '作业' };
const SOURCE_LINK = {
  checkin: (cid) => `/student/checkins`,
  emotion: (cid) => `/student/emotions`,
  survey: (cid, rid) => `/student/surveys`,
  homework: (cid, rid) => `/student/homeworks`,
  live: null,
};

// ============ 课堂状态：上课中会话 / 弹幕流状态 ============
async function classroomStatus(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    const session = await ClassSession.findOne({
      where: { course_id: course.id, status: 'ongoing' },
      order: [['id', 'DESC']],
    });
    const st = getState(course.id);
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        session: session ? { id: session.id, date: session.session_date, startTime: session.start_time } : null,
        paused: st.paused,
        currentPage: st.currentPage,
        anonymousLive: !!course.anonymous_live,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 弹幕消息列表（多来源，按时间升序） ============
async function listDanmaku(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (req.user.role === 'student' && !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const sources = req.query.sources ? String(req.query.sources).split(',') : null;
    const where = { course_id: course.id };
    if (sources && sources.length) where.source = { [Op.in]: sources };
    const msgs = await DanmakuMessage.findAll({
      where,
      order: [['id', 'ASC']],
      limit,
    });

    // 发送人 + 课程内学生序号（匿名代号）
    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    const senders = await User.findAll({ where: { id: senderIds }, attributes: ['id', 'name', 'username', 'role'] });
    const senderMap = {};
    senders.forEach((s) => (senderMap[s.id] = s));
    const courseWithStudents = await Course.findByPk(course.id, {
      include: [{ model: User, as: 'students', attributes: ['id'] }],
    });
    const studentOrder = {};
    (courseWithStudents.students || []).forEach((s, i) => {
      studentOrder[Number(s.id)] = i + 1;
    });

    // 我的点赞
    const myLikes = await DanmakuLike.findAll({
      where: { user_id: req.user.id, message_id: msgs.map((m) => m.id) },
      attributes: ['message_id'],
    });
    const likedSet = new Set(myLikes.map((l) => Number(l.message_id)));

    const isTeacherView = req.user.role === 'teacher' || req.user.role === 'admin';
    const list = msgs.map((m) => {
      const sender = senderMap[m.sender_id];
      const anonymous = !!m.is_anonymous && m.sender_role === 'student' && !isTeacherView;
      const link = SOURCE_LINK[m.source] ? SOURCE_LINK[m.source](course.id, m.ref_id) : null;
      return {
        id: m.id,
        source: m.source,
        sourceLabel: SOURCE_LABEL[m.source] || m.source,
        refId: m.ref_id != null ? Number(m.ref_id) : null,
        senderId: Number(m.sender_id),
        senderRole: m.sender_role,
        senderName: anonymous ? `同学${studentOrder[Number(m.sender_id)] || '?'}` : (sender ? sender.name : '-'),
        content: m.content,
        isAnonymous: anonymous,
        likes: Number(m.likes),
        liked: likedSet.has(Number(m.id)),
        createdAt: m.created_at,
        link,
      };
    });
    const st = getState(course.id);
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        list,
        paused: st.paused,
        pausedBy: st.pausedBy,
        currentPage: st.currentPage,
        anonymousLive: !!course.anonymous_live,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 发送弹幕/讨论 ============
async function sendDanmaku(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (req.user.role === 'student' && !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    const { source, refId, content } = req.body;
    const s = ['live', 'checkin', 'emotion', 'survey', 'homework'].includes(source) ? source : 'live';
    // 暂停拦截：教师暂停弹幕期间学生不可发送（教师/管理员不受限）
    if (req.user.role === 'student' && getState(course.id).paused) {
      return res.json({ code: 400, message: '弹幕已暂停，暂时无法发送', data: null });
    }
    if (!content || !content.trim()) return res.json({ code: 400, message: '内容不能为空', data: null });
    if (content.trim().length > 500) return res.json({ code: 400, message: '内容过长（最多 500 字）', data: null });

    // 匿名：仅 live 来源 + 老师开启 + 学生发送
    let isAnonymous = 0;
    if (s === 'live' && course.anonymous_live && req.user.role === 'student') {
      isAnonymous = 1;
    }
    const session = await ClassSession.findOne({
      where: { course_id: course.id, status: 'ongoing' },
      order: [['id', 'DESC']],
    });
    const msg = await DanmakuMessage.create({
      course_id: course.id,
      session_id: session ? session.id : null,
      source: s,
      ref_id: refId || null,
      sender_id: req.user.id,
      sender_role: req.user.role,
      content: content.trim(),
      is_anonymous: isAnonymous,
    });
    return res.json({ code: 0, message: '发送成功', data: { id: msg.id } });
  } catch (e) {
    return res.json({ code: 500, message: '发送失败：' + e.message, data: null });
  }
}

// ============ 点赞 / 取消点赞 ============
async function toggleLike(req, res) {
  try {
    const msg = await DanmakuMessage.findByPk(req.params.id);
    if (!msg) return res.json({ code: 404, message: '弹幕不存在', data: null });
    const exist = await DanmakuLike.findOne({ where: { message_id: msg.id, user_id: req.user.id } });
    if (exist) {
      await exist.destroy();
      await msg.update({ likes: Math.max(0, Number(msg.likes) - 1) });
      return res.json({ code: 0, message: '已取消点赞', data: { liked: false, likes: Number(msg.likes) } });
    }
    await DanmakuLike.create({ message_id: msg.id, user_id: req.user.id });
    await msg.update({ likes: Number(msg.likes) + 1 });
    return res.json({ code: 0, message: '点赞成功', data: { liked: true, likes: Number(msg.likes) } });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

// ============ 老师：弹幕全局暂停 / 恢复 ============
async function setPause(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师/管理员可操作', data: null });
    }
    const st = getState(course.id);
    st.paused = !!req.body.paused;
    st.pausedBy = st.paused ? req.user.id : null;
    return res.json({ code: 0, message: st.paused ? '弹幕已暂停' : '弹幕已恢复', data: { paused: st.paused } });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

// ============ 老师：匿名开关（仅作用于 live 来源） ============
async function setAnonymous(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师/管理员可操作', data: null });
    }
    await course.update({ anonymous_live: req.body.enabled ? 1 : 0 });
    return res.json({ code: 0, message: req.body.enabled ? '已开启匿名弹幕（仅实时）' : '已关闭匿名弹幕', data: { enabled: !!req.body.enabled } });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

// ============ 老师：PPT 页码同步 ============
async function setPage(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可操作', data: null });
    }
    const st = getState(course.id);
    st.currentPage = Number(req.body.page) || 1;
    return res.json({ code: 0, message: 'ok', data: { currentPage: st.currentPage } });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

module.exports = { classroomStatus, listDanmaku, sendDanmaku, toggleLike, setPause, setAnonymous, setPage };
