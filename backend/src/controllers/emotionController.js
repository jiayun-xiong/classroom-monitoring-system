// 表情反馈与学情统计控制器
// 覆盖：反馈轮次（教师开启：选知识点+设时长）、学生提交表情（1-6 分）、
// 轮次统计（课堂总人数/已提交/未提交[在课未提交 vs 未在课]/平均/方差/分布）、快照落库、我的表情历史
const EmotionFeedback = require('../models/EmotionFeedback');
const EmotionRound = require('../models/EmotionRound');
const StatSnapshot = require('../models/StatSnapshot');
const ClassSession = require('../models/ClassSession');
const Checkin = require('../models/Checkin');
const CheckinRecord = require('../models/CheckinRecord');
const Course = require('../models/Course');
const CourseStudent = require('../models/CourseStudent');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

const EMOJI = ['😵', '😕', '😐', '🙂', '😊', '🤩'];
const EMOJI_LABEL = ['完全没理解', '基本没理解', '有点模糊', '基本掌握', '掌握不错', '完全理解'];

function isOwner(course, userId) {
  return course && course.teacher_id === userId;
}

function isRoundOpen(round) {
  return round && round.status === 'open' && new Date(round.end_at).getTime() >= Date.now();
}

// ============ 教师：开启学情反馈轮次（选择知识点 + 设置反馈时长） ============
async function openEmotionRound(req, res) {
  try {
    const session = await ClassSession.findByPk(req.params.id);
    if (!session) return res.json({ code: 404, message: '会话不存在', data: null });
    const course = await Course.findByPk(session.course_id);
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可开启学情反馈', data: null });
    }
    const duration = Math.max(1, Math.min(60, Number(req.body.duration_minutes) || 5));
    const knowledgePoint = String(req.body.knowledge_point || '').trim() || '课堂反馈';
    // 同一会话同时只允许一个开放轮次：先关闭其他 open 轮次
    await EmotionRound.update(
      { status: 'closed' },
      { where: { session_id: session.id, status: 'open' } }
    );
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);
    const round = await EmotionRound.create({
      session_id: session.id,
      knowledge_point: knowledgePoint,
      duration_minutes: duration,
      start_at: startAt,
      end_at: endAt,
      status: 'open',
    });
    await notificationService.notifyStudents({
      courseId: course.id,
      type: 'emotion',
      title: '学情反馈已开启：' + knowledgePoint,
      content: '老师发起了关于「' + knowledgePoint + '」的理解反馈，请选择你的表情。',
      link: '/student/emotions',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    res.json({
      code: 0,
      message: `已开启「${knowledgePoint}」反馈（${duration} 分钟）`,
      data: { round },
    });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// ============ 教师：关闭反馈轮次 ============
async function closeEmotionRound(req, res) {
  try {
    const round = await EmotionRound.findByPk(req.params.roundId);
    if (!round) return res.json({ code: 404, message: '反馈轮次不存在', data: null });
    const session = await ClassSession.findByPk(round.session_id);
    const course = await Course.findByPk(session.course_id);
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可关闭反馈', data: null });
    }
    await round.update({ status: 'closed' });
    res.json({ code: 0, message: '已结束本次反馈', data: { round } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// ============ 学生：查询会话当前开放反馈轮次（含已提交状态） ============
async function activeRound(req, res) {
  try {
    const session = await ClassSession.findByPk(req.params.id);
    if (!session) return res.json({ code: 404, message: '会话不存在', data: null });
    const round = await EmotionRound.findOne({
      where: { session_id: session.id, status: 'open' },
      order: [['id', 'DESC']],
    });
    if (!round || !isRoundOpen(round)) {
      return res.json({ code: 0, message: 'ok', data: { round: null } });
    }
    const mine = await EmotionFeedback.findOne({
      where: { round_id: round.id, student_id: req.user.id },
      order: [['id', 'DESC']],
    });
    res.json({
      code: 0,
      message: 'ok',
      data: {
        round,
        myScore: mine ? mine.score : null,
        remainingSeconds: Math.max(0, Math.floor((new Date(round.end_at).getTime() - Date.now()) / 1000)),
      },
    });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// ============ 学生：向反馈轮次提交表情（同一轮次可多次，统计按最新） ============
async function submitEmotionToRound(req, res) {
  try {
    const round = await EmotionRound.findByPk(req.params.roundId);
    if (!round) return res.json({ code: 404, message: '反馈轮次不存在', data: null });
    if (!isRoundOpen(round)) {
      return res.json({ code: 400, message: '本次反馈已结束', data: null });
    }
    const session = await ClassSession.findByPk(round.session_id);
    const enrolled = await CourseStudent.findOne({
      where: { course_id: session.course_id, student_id: req.user.id },
    });
    if (!enrolled) return res.json({ code: 403, message: '你不在该课堂中，无法反馈', data: null });
    const score = Number(req.body.score);
    if (isNaN(score) || score < 1 || score > 6 || !Number.isInteger(score)) {
      return res.json({ code: 400, message: '表情分值必须为 1-6 的整数', data: null });
    }
    await EmotionFeedback.create({
      session_id: round.session_id,
      round_id: round.id,
      student_id: req.user.id,
      score,
    });
    res.json({ code: 0, message: `已提交：${EMOJI[score - 1]}（${score} 分）`, data: { score } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 按轮次计算统计（按每个学生最新一条记录聚合）
async function computeRoundStats(roundId) {
  const records = await EmotionFeedback.findAll({
    where: { round_id: roundId },
    attributes: ['student_id', 'score'],
    order: [['id', 'ASC']],
  });
  const latest = {};
  records.forEach((r) => {
    latest[r.student_id] = Number(r.score);
  });
  const scores = Object.values(latest);
  const submitCount = scores.length;
  const totalSubmits = records.length;
  const emptyList = { submitCount: 0, totalSubmits: 0, avgScore: null, variance: null, distribution: [0, 0, 0, 0, 0, 0], distributionStudents: [[], [], [], [], [], []] };
  if (submitCount === 0) return emptyList;
  const avg = scores.reduce((a, b) => a + b, 0) / submitCount;
  const variance = scores.reduce((a, b) => a + (b - avg) * (b - avg), 0) / submitCount;
  const distribution = [0, 0, 0, 0, 0, 0];
  scores.forEach((s) => {
    distribution[s - 1] += 1;
  });
  // 每个分值的学生名单（姓名+学号，用于前端点击查看）
  const distributionStudents = [[], [], [], [], [], []];
  const studentIds = [...new Set(records.map((r) => r.student_id))];
  const users = await User.findAll({ where: { id: studentIds }, attributes: ['id', 'username', 'name'] });
  const userMap = {};
  users.forEach((u) => {
    userMap[u.id] = u;
  });
  Object.entries(latest).forEach(([sid, score]) => {
    const u = userMap[sid];
    distributionStudents[Number(score) - 1].push({
      student_id: Number(sid),
      name: u ? u.name : '未知',
      username: u ? u.username : '',
    });
  });
  return {
    submitCount,
    totalSubmits,
    avgScore: Math.round(avg * 10) / 10,
    variance: Math.round(variance * 100) / 100,
    distribution,
    distributionStudents,
  };
}

// 未提交学生分类：在课未提交（已签到/补签） vs 未在课（请假/缺勤[无记录]）
async function classifyUnsubmitted(round, submittedIds) {
  const session = await ClassSession.findByPk(round.session_id);
  const students = await CourseStudent.findAll({ where: { course_id: session.course_id } });
  const totalIds = new Set(students.map((s) => s.student_id));
  const subIds = new Set(submittedIds.map(Number));
  const unsubmittedIds = [...totalIds].filter((id) => !subIds.has(id));

  // 出勤依据：该会话最近一次签到活动
  const latestCheckin = await Checkin.findOne({
    where: { session_id: session.id },
    order: [['id', 'DESC']],
  });
  const statusMap = {}; // student_id -> 'in' | 'out'
  const typeMap = {}; // student_id -> 具体出勤类型（normal/makeup/leave）
  if (latestCheckin) {
    const records = await CheckinRecord.findAll({
      where: { checkin_id: latestCheckin.id },
      attributes: ['student_id', 'type'],
    });
    records.forEach((r) => {
      statusMap[r.student_id] = r.type === 'leave' ? 'out' : 'in';
      typeMap[r.student_id] = r.type;
    });
    // 该签到活动无记录的学生：缺勤（未在课）
    unsubmittedIds.forEach((id) => {
      if (statusMap[id] === undefined) {
        statusMap[id] = 'out';
        typeMap[id] = 'absent'; // 缺勤（无记录）
      }
    });
  } else {
    // 未发布过签到：无法判定，视为在课
    unsubmittedIds.forEach((id) => {
      statusMap[id] = 'in';
    });
  }

  const inClass = [];
  const notInClass = [];
  for (const id of unsubmittedIds) {
    const user = await User.findByPk(id);
    const item = {
      student_id: id,
      name: user ? user.name : '未知',
      username: user ? user.username : '',
      status: typeMap[id] || (statusMap[id] === 'out' ? 'absent' : ''),
    };
    if (statusMap[id] === 'out') notInClass.push(item);
    else inClass.push(item);
  }
  return { inClassUnsubmitted: inClass, notInClassUnsubmitted: notInClass };
}

// ============ 教师/管理员：轮次统计（总人数/已提交/未提交名单细分/平均/方差/分布） ============
async function roundStats(req, res) {
  try {
    const round = await EmotionRound.findByPk(req.params.roundId);
    if (!round) return res.json({ code: 404, message: '反馈轮次不存在', data: null });
    const session = await ClassSession.findByPk(round.session_id);
    const course = await Course.findByPk(session.course_id);
    if (req.user.role !== 'admin' && !isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可查看统计', data: null });
    }
    const stats = await computeRoundStats(round.id);
    const { inClassUnsubmitted, notInClassUnsubmitted } = await classifyUnsubmitted(round, Object.keys(await latestStudentScores(round.id)));
    const totalStudents = inClassUnsubmitted.length + notInClassUnsubmitted.length + stats.submitCount;
    res.json({
      code: 0,
      message: 'ok',
      data: {
        round,
        ...stats,
        totalStudents,
        unsubmittedCount: totalStudents - stats.submitCount,
        inClassUnsubmitted,
        notInClassUnsubmitted,
        emoji: EMOJI,
        emojiLabel: EMOJI_LABEL,
      },
    });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

async function latestStudentScores(roundId) {
  const records = await EmotionFeedback.findAll({
    where: { round_id: roundId },
    attributes: ['student_id', 'score'],
    order: [['id', 'ASC']],
  });
  const latest = {};
  records.forEach((r) => {
    latest[r.student_id] = Number(r.score);
  });
  return latest;
}

// ============ 教师：生成轮次统计快照 / 快照历史 ============
async function snapshotRound(req, res) {
  try {
    const round = await EmotionRound.findByPk(req.params.roundId);
    if (!round) return res.json({ code: 404, message: '反馈轮次不存在', data: null });
    const session = await ClassSession.findByPk(round.session_id);
    const course = await Course.findByPk(session.course_id);
    if (!isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可生成快照', data: null });
    }
    const stats = await computeRoundStats(round.id);
    const snapshot = await StatSnapshot.create({
      session_id: round.session_id,
      round_id: round.id,
      period_start: round.start_at,
      period_end: new Date(),
      submit_count: stats.submitCount,
      avg_score: stats.avgScore,
      variance: stats.variance,
      dist_json: JSON.stringify(stats.distribution),
    });
    res.json({ code: 0, message: '快照已保存', data: { snapshot } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

async function roundSnapshots(req, res) {
  try {
    const round = await EmotionRound.findByPk(req.params.roundId);
    if (!round) return res.json({ code: 404, message: '反馈轮次不存在', data: null });
    const session = await ClassSession.findByPk(round.session_id);
    const course = await Course.findByPk(session.course_id);
    if (req.user.role !== 'admin' && !isOwner(course, req.user.id)) {
      return res.json({ code: 403, message: '仅授课教师可查看', data: null });
    }
    const snapshots = await StatSnapshot.findAll({
      where: { round_id: round.id },
      order: [['id', 'DESC']],
      limit: 50,
    });
    res.json({ code: 0, message: 'ok', data: { snapshots } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// ============ 学生：我的表情历史（跨课程最近 50 条，含知识点） ============
async function myEmotions(req, res) {
  try {
    const records = await EmotionFeedback.findAll({
      where: { student_id: req.user.id },
      include: [
        { model: ClassSession, as: 'session', include: [{ model: Course, as: 'course' }] },
      ],
      order: [['id', 'DESC']],
      limit: 50,
    });
    // 附带轮次知识点
    const roundIds = [...new Set(records.map((r) => r.round_id).filter(Boolean))];
    const rounds = roundIds.length
      ? await EmotionRound.findAll({ where: { id: roundIds }, attributes: ['id', 'knowledge_point'] })
      : [];
    const roundMap = {};
    rounds.forEach((r) => {
      roundMap[r.id] = r.knowledge_point;
    });
    const list = records.map((r) => {
      const plain = r.get({ plain: true });
      plain.knowledge_point = r.round_id ? roundMap[r.round_id] || null : null;
      return plain;
    });
    res.json({
      code: 0,
      message: 'ok',
      data: {
        records: list,
        emoji: EMOJI,
        emojiLabel: EMOJI_LABEL,
      },
    });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

module.exports = {
  openEmotionRound,
  closeEmotionRound,
  activeRound,
  submitEmotionToRound,
  roundStats,
  snapshotRound,
  roundSnapshots,
  myEmotions,
  computeRoundStats,
  EMOJI,
  EMOJI_LABEL,
};
