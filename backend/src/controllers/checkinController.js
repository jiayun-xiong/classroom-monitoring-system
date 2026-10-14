// 课堂会话与定位签到控制器
// 覆盖：开始/结束上课（class_sessions）、发布签到（checkins）、学生定位签到（checkin_records）、补签/请假、出勤统计
const { Op } = require('sequelize');
const ClassSession = require('../models/ClassSession');
const Checkin = require('../models/Checkin');
const CheckinRecord = require('../models/CheckinRecord');
const EmotionRound = require('../models/EmotionRound');
const Course = require('../models/Course');
const CourseStudent = require('../models/CourseStudent');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

const MAX_DISTANCE = 200; // 200m 判定阈值
const DEFAULT_WINDOW = 5; // 默认签到窗口 5 分钟
const MIN_WINDOW = 2;
const MAX_WINDOW = 10;
const LATE_GRACE_MINUTES = 5; // 签到发布后 5 分钟内为正常，超过计迟到（迟到计入到课）

// Haversine 球面距离（米）
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 校验某教师是否某课程的授课教师
function isOwner(course, userId) {
  return course && course.teacher_id === userId;
}

// 教师开始上课（若已有进行中会话则复用）
async function startSession(req, res) {
  try {
    const courseId = req.params.id;
    const course = await Course.findByPk(courseId);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可开始上课', data: null });
    }
    const ongoing = await ClassSession.findOne({ where: { course_id: courseId, status: 'ongoing' } });
    if (ongoing) {
      return res.json({ code: 0, message: '课堂已在进行中', data: { session: ongoing } });
    }
    const now = new Date();
    const session = await ClassSession.create({
      course_id: courseId,
      session_date: now.toISOString().slice(0, 10),
      start_time: now,
      status: 'ongoing',
    });
    res.json({ code: 0, message: '开始上课', data: { session } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师结束上课
async function endSession(req, res) {
  try {
    const session = await ClassSession.findByPk(req.params.id);
    if (!session) return res.json({ code: 404, message: '会话不存在', data: null });
    const course = await Course.findByPk(session.course_id);
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可结束上课', data: null });
    }
    if (session.status !== 'ongoing') {
      return res.json({ code: 400, message: '课堂已结束', data: null });
    }
    await session.update({ status: 'ended', end_time: new Date() });
    // 同步关闭该会话下所有进行中的签到
    await Checkin.update(
      { status: 'closed' },
      { where: { session_id: session.id, status: 'open' } }
    );
    res.json({ code: 0, message: '已结束上课', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 会话列表（教师=全部，学生=含进行中状态）
async function listSessions(req, res) {
  try {
    const courseId = req.params.id;
    const course = await Course.findByPk(courseId);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (req.user.role === 'teacher' && !isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可查看', data: null });
    }
    if (req.user.role === 'student') {
      const enrolled = await CourseStudent.findOne({ where: { course_id: courseId, student_id: req.user.id } });
      if (!enrolled) return res.json({ code: 403, message: '尚未加入该课堂', data: null });
    }
    const sessions = await ClassSession.findAll({
      where: { course_id: courseId },
      include: [
        { model: Checkin, as: 'checkins' },
        { model: EmotionRound, as: 'emotionRounds', order: [['id', 'DESC']] },
      ],
      order: [['id', 'DESC']],
    });
    res.json({ code: 0, message: 'ok', data: { sessions } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师发布定位签到（基准点=教师实时位置，限时窗口）
async function publishCheckin(req, res) {
  try {
    const session = await ClassSession.findByPk(req.params.id);
    if (!session) return res.json({ code: 404, message: '会话不存在', data: null });
    const course = await Course.findByPk(session.course_id);
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可发布签到', data: null });
    }
    if (session.status !== 'ongoing') {
      return res.json({ code: 400, message: '课堂未在进行中，请先开始上课', data: null });
    }
    const { lat, lng, windowMinutes } = req.body;
    if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return res.json({ code: 400, message: '缺少教师定位（经度/纬度）', data: null });
    }
    const win = Number(windowMinutes) || DEFAULT_WINDOW;
    if (win < MIN_WINDOW || win > MAX_WINDOW) {
      return res.json({ code: 400, message: `签到窗口需在 ${MIN_WINDOW}-${MAX_WINDOW} 分钟之间`, data: null });
    }
    const now = new Date();
    const end = new Date(now.getTime() + win * 60 * 1000);
    const checkin = await Checkin.create({
      session_id: session.id,
      teacher_lat: Number(lat),
      teacher_lng: Number(lng),
      window_minutes: win,
      start_time: now,
      end_time: end,
      status: 'open',
    });
    await notificationService.notifyStudents({
      courseId: course.id,
      type: 'checkin',
      title: '签到已发布',
      content: '老师发布了定位签到（' + win + ' 分钟窗口），请尽快签到。',
      link: '/student/checkins',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    res.json({ code: 0, message: `签到已发布（${win} 分钟）`, data: { checkin } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 学生定位签到（200m 判定 + 防代签）
async function signCheckin(req, res) {
  try {
    const checkin = await Checkin.findByPk(req.params.id, { include: [{ model: ClassSession, as: 'session' }] });
    if (!checkin) return res.json({ code: 404, message: '签到活动不存在', data: null });
    const { lat, lng, deviceId } = req.body;
    if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return res.json({ code: 400, message: '无法获取定位，请检查浏览器定位权限', data: null });
    }
    // 在册校验
    const enrolled = await CourseStudent.findOne({
      where: { course_id: checkin.session.course_id, student_id: req.user.id },
    });
    if (!enrolled) return res.json({ code: 403, message: '你不在该课堂中，无法签到', data: null });
    // 状态与窗口校验
    const now = new Date();
    if (checkin.status !== 'open' || now > new Date(checkin.end_time)) {
      return res.json({ code: 400, message: '签到已截止', data: null });
    }
    // 防代签：同账号本次签到仅一次（success 后拦截）
    const myRecord = await CheckinRecord.findOne({ where: { checkin_id: checkin.id, student_id: req.user.id } });
    if (myRecord && myRecord.result === 'success') {
      return res.json({ code: 400, message: '你已完成签到，请勿重复提交', data: null });
    }
    // 防代签：同设备本次签到仅一次（success 后拦截）
    if (deviceId) {
      const deviceRecord = await CheckinRecord.findOne({
        where: { checkin_id: checkin.id, device_id: deviceId, result: 'success' },
      });
      if (deviceRecord && deviceRecord.student_id !== req.user.id) {
        return res.json({ code: 400, message: '该设备已完成签到，请勿代签', data: null });
      }
    }
    // 距离判定（Haversine ≤ 200m）
    const distance = haversine(
      Number(checkin.teacher_lat),
      Number(checkin.teacher_lng),
      Number(lat),
      Number(lng)
    );
    const success = distance <= MAX_DISTANCE;
    // 迟到判定：签到成功且签到时刻晚于发布时刻 + 宽限期 → 迟到（迟到计入到课）
    const isLate =
      success &&
      now.getTime() - new Date(checkin.start_time).getTime() > LATE_GRACE_MINUTES * 60 * 1000;
    const attendType = success ? (isLate ? 'late' : 'normal') : null;
    // 写入/更新记录（失败可重试覆盖，成功不允许重复）
    if (myRecord) {
      await myRecord.update({
        lat: Number(lat),
        lng: Number(lng),
        distance,
        result: success ? 'success' : 'fail',
        type: attendType || myRecord.type,
        device_id: deviceId || myRecord.device_id,
        signed_at: new Date(),
      });
    } else {
      await CheckinRecord.create({
        checkin_id: checkin.id,
        student_id: req.user.id,
        lat: Number(lat),
        lng: Number(lng),
        distance,
        result: success ? 'success' : 'fail',
        type: attendType || 'normal',
        device_id: deviceId || null,
        signed_at: new Date(),
      });
    }
    res.json({
      code: 0,
      message: success ? (isLate ? '签到成功（迟到）' : '签到成功') : `签到失败：距基准点 ${distance} 米（超过 200 米）`,
      data: { result: success ? 'success' : 'fail', distance, type: attendType || null },
    });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 签到统计（教师）：应到/已签/未签明细 + 补签/请假
async function checkinStats(req, res) {
  try {
    const checkin = await Checkin.findByPk(req.params.id, { include: [{ model: ClassSession, as: 'session' }] });
    if (!checkin) return res.json({ code: 404, message: '签到活动不存在', data: null });
    const course = await Course.findByPk(checkin.session.course_id);
    if (req.user.role !== 'admin' && !isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可查看统计', data: null });
    }
    const students = await User.findAll({
      attributes: ['id', 'username', 'name'],
      include: [{ model: Course, as: 'joinedCourses', where: { id: checkin.session.course_id }, through: { attributes: [] }, attributes: [] }],
      order: [['id', 'ASC']],
    });
    const records = await CheckinRecord.findAll({
      where: { checkin_id: checkin.id },
      include: [{ model: User, as: 'student', attributes: ['id', 'username', 'name'] }],
    });
    const recordMap = {};
    records.forEach((r) => {
      recordMap[r.student_id] = r;
    });
    const list = students.map((s) => {
      const r = recordMap[s.id];
      let status = 'absent'; // 缺勤（无任何记录）
      if (r) {
        if (r.type === 'leave') status = 'leave';
        else if (r.type === 'makeup') status = 'makeup';
        else if (r.type === 'absent') status = 'absent';
        else if (r.type === 'late') status = 'late';
        else if (r.result === 'success') status = 'normal';
        else status = 'fail';
      }
      return {
        student: { id: s.id, username: s.username, name: s.name },
        status,
        distance: r ? Number(r.distance) : null,
        reason: r ? r.reason : null,
        signedAt: r ? r.signed_at : null,
      };
    });
    const shouldCount = list.length;
    const normalCount = list.filter((i) => i.status === 'normal').length;
    const lateCount = list.filter((i) => i.status === 'late').length;
    const makeupCount = list.filter((i) => i.status === 'makeup').length;
    const leaveCount = list.filter((i) => i.status === 'leave').length;
    const absentCount = list.filter((i) => i.status === 'absent').length;
    const failCount = list.filter((i) => i.status === 'fail').length;
    res.json({
      code: 0,
      message: 'ok',
      data: {
        checkin,
        shouldCount,
        // 到课 = 正常 + 补签 + 迟到（迟到计入到课）
        signedCount: normalCount + makeupCount + lateCount,
        normalCount,
        lateCount,
        makeupCount,
        leaveCount,
        absentCount,
        failCount,
        list,
      },
    });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师登记补签
async function makeupCheckin(req, res) {
  try {
    const checkin = await Checkin.findByPk(req.params.id, { include: [{ model: ClassSession, as: 'session' }] });
    if (!checkin) return res.json({ code: 404, message: '签到活动不存在', data: null });
    const course = await Course.findByPk(checkin.session.course_id);
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可补签', data: null });
    }
    const { studentId, reason } = req.body;
    let record = await CheckinRecord.findOne({ where: { checkin_id: checkin.id, student_id: studentId } });
    if (record && record.type === 'leave') {
      return res.json({ code: 400, message: '该学生已登记请假，无需补签', data: null });
    }
    if (!record) {
      record = await CheckinRecord.create({
        checkin_id: checkin.id,
        student_id: studentId,
        result: 'success',
        type: 'makeup',
        reason: reason || '教师补签',
        signed_at: new Date(),
      });
    } else {
      await record.update({ result: 'success', type: 'makeup', reason: reason || record.reason || '教师补签', signed_at: new Date() });
    }
    await notificationService.notifyUser({
      userId: studentId,
      courseId: course.id,
      type: 'checkin',
      title: '已为你补签',
      content: '老师已为你补签本次课堂签到。',
      link: '/student/checkins',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    res.json({ code: 0, message: '已补签', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师登记请假（请假期间不参与签到，不计缺勤）
async function leaveCheckin(req, res) {
  try {
    const checkin = await Checkin.findByPk(req.params.id, { include: [{ model: ClassSession, as: 'session' }] });
    if (!checkin) return res.json({ code: 404, message: '签到活动不存在', data: null });
    const course = await Course.findByPk(checkin.session.course_id);
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可登记请假', data: null });
    }
    const { studentId, reason } = req.body;
    let record = await CheckinRecord.findOne({ where: { checkin_id: checkin.id, student_id: studentId } });
    if (!record) {
      record = await CheckinRecord.create({
        checkin_id: checkin.id,
        student_id: studentId,
        type: 'leave',
        reason: reason || '事假',
        signed_at: new Date(),
      });
    } else {
      await record.update({ type: 'leave', reason: reason || record.reason || '事假' });
    }
    await notificationService.notifyUser({
      userId: studentId,
      courseId: course.id,
      type: 'checkin',
      title: '已登记请假',
      content: '老师已为你登记请假（' + (reason || '事假') + '）。',
      link: '/student/checkins',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    res.json({ code: 0, message: '已登记请假', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 学生端：我的签到记录（跨课程最近 50 条）
async function myCheckins(req, res) {
  try {
    const records = await CheckinRecord.findAll({
      where: { student_id: req.user.id },
      include: [
        {
          model: Checkin,
          as: 'checkin',
          include: [{ model: ClassSession, as: 'session', include: [{ model: Course, as: 'course' }] }],
        },
      ],
      order: [['id', 'DESC']],
      limit: 50,
    });
    res.json({ code: 0, message: 'ok', data: { records } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

module.exports = {
  startSession,
  endSession,
  listSessions,
  publishCheckin,
  signCheckin,
  checkinStats,
  makeupCheckin,
  leaveCheckin,
  myCheckins,
};
