// 通知中心控制器
// 覆盖：三端收件箱（业务自动触发 + 手动发送）、未读数、已读/全部已读、发送消息
const Notification = require('../models/Notification');
const NotificationRead = require('../models/NotificationRead');
const Course = require('../models/Course');
const CourseStudent = require('../models/CourseStudent');
const User = require('../models/User');
const { Op } = require('sequelize');

async function isTeacherOfCourse(course, userId) {
  return Number(course.teacher_id) === Number(userId);
}

// 发给当前用户的通知基础条件（receiver_role 匹配；发给本人 或 发给该角色全体）
function myWhere(me, extra = {}) {
  return {
    receiver_role: me.role,
    [Op.or]: [{ receiver_id: me.id }, { receiver_id: null }],
    ...extra,
  };
}

// 取当前用户的未读通知（per-user：尚无该用户已读记录）
async function myUnreadRows(me, extra = {}) {
  const rows = await Notification.findAll({
    where: myWhere(me, extra),
    include: [{ model: NotificationRead, as: 'reads', where: { user_id: me.id }, required: false }],
  });
  return rows.filter((n) => !n.reads || n.reads.length === 0);
}

// 教师过滤：仅保留本人授课课程的通知（发给本人的保留）
async function teacherVisibleRows(me, rows) {
  if (me.role !== 'teacher') return rows;
  const myCourses = await Course.findAll({ where: { teacher_id: me.id }, attributes: ['id'] });
  const myIds = new Set(myCourses.map((c) => Number(c.id)));
  return rows.filter(
    (n) => n.course_id == null || myIds.has(Number(n.course_id)) || (n.receiver_id != null && Number(n.receiver_id) === Number(me.id))
  );
}

// 批量标记为当前用户已读（幂等）
async function markRowsRead(me, rows) {
  const values = rows.map((n) => ({ notification_id: n.id, user_id: me.id }));
  if (values.length) {
    await NotificationRead.bulkCreate(values, { ignoreDuplicates: true });
  }
  return values.length;
}

// ============ 当前用户收件箱 ============
async function listNotifications(req, res) {
  try {
    const me = req.user;
    // 我可见：发给我的（receiver_id=me）或发给本角色全体的（receiver_role=me.role 且 receiver_id IS NULL）
    const where = {
      [Op.or]: [
        { receiver_id: me.id },
        { receiver_role: me.role, receiver_id: null },
      ],
    };
    const notifs = await Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 100,
      include: [{ model: NotificationRead, as: 'reads', where: { user_id: me.id }, required: false }],
    });

    // 教师：仅展示自己授课课程的通知（全班/教师角色的通知可能跨课程）
    let filtered = notifs;
    if (me.role === 'teacher') {
      const myCourses = await Course.findAll({ where: { teacher_id: me.id }, attributes: ['id'] });
      const myIds = new Set(myCourses.map((c) => Number(c.id)));
      filtered = notifs.filter(
        (n) => n.course_id == null || myIds.has(Number(n.course_id)) || (n.receiver_id != null && Number(n.receiver_id) === Number(me.id))
      );
    }

    // 发送人姓名 + 课程名
    const senderIds = [...new Set(filtered.map((n) => n.sender_id).filter((x) => x != null))];
    const senders = await User.findAll({ where: { id: senderIds }, attributes: ['id', 'name', 'role'] });
    const senderMap = {};
    senders.forEach((s) => {
      senderMap[s.id] = s;
    });
    const courseIds = [...new Set(filtered.map((n) => n.course_id).filter((x) => x != null))];
    const courses = await Course.findAll({ where: { id: courseIds }, attributes: ['id', 'name'] });
    const courseMap = {};
    courses.forEach((c) => {
      courseMap[c.id] = c;
    });

    const list = filtered.map((n) => ({
      id: n.id,
      courseId: n.course_id != null ? Number(n.course_id) : null,
      courseName: n.course_id != null && courseMap[n.course_id] ? courseMap[n.course_id].name : null,
      senderId: n.sender_id != null ? Number(n.sender_id) : null,
      senderName: n.sender_id != null && senderMap[n.sender_id] ? senderMap[n.sender_id].name : (n.sender_role === 'system' ? '系统' : '-'),
      senderRole: n.sender_role,
      receiverRole: n.receiver_role,
      type: n.type,
      title: n.title,
      content: n.content,
      link: n.link,
      isRead: !!(n.reads && n.reads.length > 0),
      createdAt: n.created_at,
    }));
    return res.json({ code: 0, message: 'ok', data: { list } });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 未读数 ============
// 按类型统计未读数（学生端功能卡角标用）
async function unreadByType(req, res) {
  try {
    const me = req.user;
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    const extra = courseId ? { course_id: courseId } : {};
    let rows = await myUnreadRows(me, extra);
    rows = await teacherVisibleRows(me, rows);
    const counts = { message: 0, homework: 0, survey: 0, exam: 0, score: 0, checkin: 0, emotion: 0 };
    rows.forEach((r) => {
      if (counts[r.type] !== undefined) counts[r.type] += 1;
    });
    return res.json({ code: 0, message: 'ok', data: counts });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

async function unreadCount(req, res) {
  try {
    const me = req.user;
    let rows = await myUnreadRows(me);
    rows = await teacherVisibleRows(me, rows);
    return res.json({ code: 0, message: 'ok', data: { count: rows.length } });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 发送消息 ============
async function sendNotification(req, res) {
  try {
    const me = req.user;
    const { receiverRole, receiverIds, courseId, title, content, link } = req.body;
    if (!title || !title.trim()) return res.json({ code: 400, message: '请填写消息标题', data: null });
    if (!receiverRole) return res.json({ code: 400, message: '缺少接收角色', data: null });

    let course = null;
    if (courseId) {
      course = await Course.findByPk(courseId);
      if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    }

    if (me.role === 'teacher') {
      // 教师 → 学生（本课程全班或指定学生）
      if (receiverRole !== 'student') return res.json({ code: 400, message: '教师仅可给学生发送消息', data: null });
      if (!course || !(await isTeacherOfCourse(course, me.id))) {
        return res.json({ code: 400, message: '只能给本人授课的课程学生发送消息', data: null });
      }
      if (receiverIds && receiverIds.length) {
        for (const sid of receiverIds) {
          const inCourse = await CourseStudent.findOne({ where: { course_id: course.id, student_id: sid } });
          if (!inCourse) return res.json({ code: 400, message: '存在不在本课程中的学生', data: null });
          await Notification.create({
            course_id: course.id,
            sender_id: me.id,
            sender_role: 'teacher',
            receiver_id: sid,
            receiver_role: 'student',
            type: 'message',
            title: title.trim(),
            content: content || '',
            link: link || null,
          });
        }
      } else {
        await Notification.create({
          course_id: course.id,
          sender_id: me.id,
          sender_role: 'teacher',
          receiver_id: null,
          receiver_role: 'student',
          type: 'message',
          title: title.trim(),
          content: content || '',
          link: link || null,
        });
      }
    } else if (me.role === 'student') {
      // 学生 → 授课教师（本课程）
      if (receiverRole !== 'teacher') return res.json({ code: 400, message: '学生仅可给授课教师发送消息', data: null });
      if (!course) return res.json({ code: 400, message: '请选择课程', data: null });
      const inCourse = await CourseStudent.findOne({ where: { course_id: course.id, student_id: me.id } });
      if (!inCourse) return res.json({ code: 400, message: '你不在该课程中', data: null });
      await Notification.create({
        course_id: course.id,
        sender_id: me.id,
        sender_role: 'student',
        receiver_id: null, // 课程授课教师（前端/查询按课程归属过滤）
        receiver_role: 'teacher',
        type: 'message',
        title: title.trim(),
        content: content || '',
        link: link || null,
      });
    } else if (me.role === 'admin') {
      // 管理员 → 任一角色（全体或指定）
      if (receiverIds && receiverIds.length) {
        for (const uid of receiverIds) {
          await Notification.create({
            course_id: course ? course.id : null,
            sender_id: me.id,
            sender_role: 'admin',
            receiver_id: uid,
            receiver_role: receiverRole,
            type: 'message',
            title: title.trim(),
            content: content || '',
            link: link || null,
          });
        }
      } else {
        await Notification.create({
          course_id: course ? course.id : null,
          sender_id: me.id,
          sender_role: 'admin',
          receiver_id: null,
          receiver_role: receiverRole,
          type: 'message',
          title: title.trim(),
          content: content || '',
          link: link || null,
        });
      }
    } else {
      return res.json({ code: 400, message: '无发送权限', data: null });
    }
    return res.json({ code: 0, message: '消息已发送', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '发送失败：' + e.message, data: null });
  }
}

// ============ 标记已读 ============
async function markRead(req, res) {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return res.json({ code: 404, message: '通知不存在', data: null });
    // 仅本人可见的通知可标记（接收人本人 或 角色全体）
    const me = req.user;
    const visible =
      (n.receiver_id != null && Number(n.receiver_id) === Number(me.id)) ||
      (n.receiver_id == null && n.receiver_role === me.role);
    if (!visible) return res.json({ code: 403, message: '无权限操作该通知', data: null });
    await NotificationRead.findOrCreate({ where: { notification_id: n.id, user_id: me.id } });
    return res.json({ code: 0, message: 'ok', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

// ============ 全部已读 ============
async function markAllRead(req, res) {
  try {
    const me = req.user;
    let rows = await Notification.findAll({ where: myWhere(me), attributes: ['id'], raw: true });
    rows = await teacherVisibleRows(me, rows);
    const count = await markRowsRead(me, rows);
    return res.json({ code: 0, message: 'ok', data: { updated: count } });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

// ============ 按课程+类型标记已读（功能卡角标处理即已读） ============
async function readByType(req, res) {
  try {
    const me = req.user;
    const { courseId, type } = req.body;
    if (!courseId || !type) return res.json({ code: 400, message: '参数缺失', data: null });
    const rows = await Notification.findAll({
      where: myWhere(me, { course_id: Number(courseId), type }),
      attributes: ['id'],
      raw: true,
    });
    const count = await markRowsRead(me, rows);
    return res.json({ code: 0, message: 'ok', data: { updated: count } });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

module.exports = { listNotifications, unreadCount, unreadByType, sendNotification, markRead, markAllRead, readByType };
