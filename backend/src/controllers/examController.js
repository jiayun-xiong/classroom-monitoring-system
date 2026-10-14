// 期末考试控制器
// 覆盖：教师发布考试（名称/时间/满分/形式）、考试列表（教师录入进度+学生我的成绩）、
//      教师录入/确认成绩、学生线上作答提交、加权总成绩与排名
const sequelize = require('../config/database');
const Exam = require('../models/Exam');
const ExamScore = require('../models/ExamScore');
const Course = require('../models/Course');
const ScoreWeight = require('../models/ScoreWeight');
const ClassSession = require('../models/ClassSession');
const Checkin = require('../models/Checkin');
const CheckinRecord = require('../models/CheckinRecord');
const Homework = require('../models/Homework');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const HomeworkExempt = require('../models/HomeworkExempt');
const CourseStudent = require('../models/CourseStudent');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

async function isTeacherOrAdmin(course, userId, role) {
  return role === 'admin' || Number(course.teacher_id) === Number(userId);
}

async function isEnrolled(courseId, studentId) {
  const c = await CourseStudent.findOne({ where: { course_id: courseId, student_id: studentId } });
  return !!c;
}

// ============ 教师：发布考试 ============
async function createExam(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可发布考试', data: null });
    }
    const { name, examTime, fullScore, form } = req.body;
    if (!name || !name.trim()) return res.json({ code: 400, message: '必须填写考试名称', data: null });
    if (!examTime) return res.json({ code: 400, message: '必须选择考试时间', data: null });
    if (!fullScore || Number(fullScore) <= 0) return res.json({ code: 400, message: '满分必须大于 0', data: null });
    const exam = await Exam.create({
      course_id: course.id,
      name: name.trim(),
      exam_time: new Date(examTime),
      full_score: Number(fullScore),
      form: form === 'online' ? 'online' : 'offline',
      created_by: req.user.id,
    });
    await notificationService.notifyStudents({
      courseId: course.id,
      type: 'exam',
      title: '新考试发布：' + exam.name,
      content: '老师发布了「' + exam.name + '」，满分 ' + Number(exam.full_score) + ' 分。',
      link: '/student/exams',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    return res.json({ code: 0, message: '考试已发布', data: { id: exam.id } });
  } catch (e) {
    return res.json({ code: 500, message: '发布失败：' + e.message, data: null });
  }
}

// ============ 教师/学生：考试列表 ============
async function listExams(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (req.user.role === 'student' && !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    const exams = await Exam.findAll({
      where: { course_id: course.id },
      order: [['exam_time', 'DESC']],
    });

    if (req.user.role === 'student') {
      const list = [];
      for (const e of exams) {
        const my = await ExamScore.findOne({ where: { exam_id: e.id, student_id: req.user.id } });
        list.push({
          id: e.id,
          name: e.name,
          examTime: e.exam_time,
          fullScore: Number(e.full_score),
          form: e.form,
          myScore: my
            ? { score: Number(my.score), source: my.source, confirmed: my.source === 'teacher' }
            : null,
        });
      }
      return res.json({ code: 0, message: 'ok', data: { list } });
    }

    // 教师：带录入进度
    const list = [];
    for (const e of exams) {
      const count = await ExamScore.count({ where: { exam_id: e.id } });
      list.push({
        id: e.id,
        name: e.name,
        examTime: e.exam_time,
        fullScore: Number(e.full_score),
        form: e.form,
        scoredCount: count,
      });
    }
    return res.json({ code: 0, message: 'ok', data: { list } });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 教师：考试成绩名单 ============
async function getExamScores(req, res) {
  try {
    const exam = await Exam.findByPk(req.params.id);
    if (!exam) return res.json({ code: 404, message: '考试不存在', data: null });
    const course = await Course.findByPk(exam.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可查看成绩', data: null });
    }
    const courseWithStudents = await Course.findByPk(course.id, {
      include: [{ model: User, as: 'students', attributes: ['id', 'username', 'name'] }],
    });
    const students = courseWithStudents.students || [];
    const scores = await ExamScore.findAll({ where: { exam_id: exam.id } });
    const byStudent = {};
    scores.forEach((s) => {
      byStudent[s.student_id] = s;
    });
    const rows = students.map((st) => ({
      student_id: Number(st.id),
      name: st.name,
      username: st.username,
      score: byStudent[st.id] ? Number(byStudent[st.id].score) : null,
      source: byStudent[st.id] ? byStudent[st.id].source : null,
    }));
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        exam: {
          id: exam.id,
          name: exam.name,
          examTime: exam.exam_time,
          fullScore: Number(exam.full_score),
          form: exam.form,
        },
        rows,
        scoredCount: Object.keys(byStudent).length,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 教师：录入/确认成绩 ============
async function saveScores(req, res) {
  try {
    const exam = await Exam.findByPk(req.params.id);
    if (!exam) return res.json({ code: 404, message: '考试不存在', data: null });
    const course = await Course.findByPk(exam.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可录入成绩', data: null });
    }
    const { scores } = req.body;
    if (!Array.isArray(scores) || scores.length === 0) {
      return res.json({ code: 400, message: '没有可保存的成绩', data: null });
    }
    const full = Number(exam.full_score);
    await sequelize.transaction(async (t) => {
      for (const item of scores) {
        if (item.studentId == null) continue;
        if (item.score === null || item.score === undefined || item.score === '') continue;
        const s = Number(item.score);
        if (Number.isNaN(s) || s < 0 || s > full) {
          throw new Error('成绩需在 0-' + full + ' 之间（学生：' + item.studentId + '）');
        }
        const [row] = await ExamScore.findOrCreate({
          where: { exam_id: exam.id, student_id: item.studentId },
          defaults: { exam_id: exam.id, student_id: item.studentId, score: s, source: 'teacher' },
          transaction: t,
        });
        if (row.source !== 'teacher' || Number(row.score) !== s) {
          await row.update({ score: s, source: 'teacher' }, { transaction: t });
        }
      }
    });
    for (const item of scores) {
      if (item.studentId == null || item.score === null || item.score === undefined || item.score === '') continue;
      await notificationService.notifyUser({
        userId: item.studentId,
        courseId: course.id,
        type: 'exam',
        title: '期末成绩已录入：' + exam.name,
        content: '「' + exam.name + '」的成绩已录入，可在我的成绩中查看。',
        link: '/student/scores',
        senderId: req.user.id,
        senderRole: 'teacher',
      });
    }
    return res.json({ code: 0, message: '成绩已保存', data: null });
  } catch (e) {
    return res.json({ code: 400, message: e.message.includes('成绩需在') ? e.message : '保存失败：' + e.message, data: null });
  }
}

// ============ 学生：线上作答提交（自报成绩，教师可确认/修改） ============
async function submitScore(req, res) {
  try {
    const exam = await Exam.findByPk(req.params.id);
    if (!exam) return res.json({ code: 404, message: '考试不存在', data: null });
    if (req.user.role !== 'student') return res.json({ code: 403, message: '仅学生可作答', data: null });
    const course = await Course.findByPk(exam.course_id);
    if (!(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    if (exam.form !== 'online') {
      return res.json({ code: 400, message: '该考试为线下录入，无需在线作答', data: null });
    }
    if (new Date(exam.exam_time).getTime() < Date.now()) {
      return res.json({ code: 400, message: '考试时间已过，无法作答', data: null });
    }
    const { score } = req.body;
    const s = Number(score);
    if (Number.isNaN(s) || s < 0 || s > Number(exam.full_score)) {
      return res.json({ code: 400, message: `成绩需在 0-${Number(exam.full_score)} 之间`, data: null });
    }
    const [row] = await ExamScore.findOrCreate({
      where: { exam_id: exam.id, student_id: req.user.id },
      defaults: { exam_id: exam.id, student_id: req.user.id, score: s, source: 'student' },
    });
    if (row.source === 'teacher') {
      return res.json({ code: 400, message: '教师已确认成绩，无法修改', data: null });
    }
    await row.update({ score: s, source: 'student' });
    await notificationService.notifyTeacher({
      courseId: course.id,
      type: 'exam',
      title: '学生提交考试作答：' + exam.name,
      content: '有学生提交了「' + exam.name + '」的作答，请确认成绩。',
      link: '/teacher/exams',
      senderId: req.user.id,
      senderRole: 'student',
    });
    return res.json({ code: 0, message: '作答已提交，等待教师确认', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '提交失败：' + e.message, data: null });
  }
}

// ============ 加权总成绩与排名 ============
async function finalScores(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (req.user.role === 'student' && !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    if (req.user.role === 'teacher' && !(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可查看', data: null });
    }

    const [weight] = await ScoreWeight.findOrCreate({
      where: { course_id: course.id },
      defaults: { course_id: course.id },
    });
    const cw = Number(weight.checkin_weight);
    const hw = Number(weight.homework_weight);
    const ew = Number(weight.exam_weight);

    const courseWithStudents = await Course.findByPk(course.id, {
      include: [{ model: User, as: 'students', attributes: ['id', 'username', 'name'] }],
    });
    const students = courseWithStudents.students || [];
    if (students.length === 0) {
      return res.json({ code: 0, message: 'ok', data: { list: [], weights: { checkinWeight: cw, homeworkWeight: hw, examWeight: ew }, me: null } });
    }

    // 1) 签到成绩：出勤率（正常+补签）/ 应签到次数（课程会话数）x100
    // 关联链：ClassSession(course_id) -> Checkin(session_id) -> CheckinRecord(checkin_id)
    const sessions = await ClassSession.findAll({ where: { course_id: course.id }, attributes: ['id'] });
    const sessionCount = sessions.length;
    const checkinActs = await Checkin.findAll(
      { where: { session_id: sessions.map((s) => s.id) }, attributes: ['id'] }
    );
    const checkinIds = checkinActs.map((c) => c.id);
    let checkins = [];
    if (checkinIds.length) {
      checkins = await CheckinRecord.findAll({
        where: { checkin_id: checkinIds, type: ['normal', 'makeup', 'late'] }, // 迟到计入到课
        attributes: ['student_id'],
      });
    }
    const checkinCount = {};
    checkins.forEach((c) => {
      checkinCount[c.student_id] = (checkinCount[c.student_id] || 0) + 1;
    });

    // 2) 作业成绩：非豁免作业的平均分（未提交/未批改计 0；豁免不计入分母）
    const homeworks = await Homework.findAll({ where: { course_id: course.id }, attributes: ['id'] });
    const hwIds = homeworks.map((h) => h.id);
    const exempts = await HomeworkExempt.findAll({ where: { homework_id: hwIds }, attributes: ['homework_id', 'student_id'] });
    const exemptSet = new Set(exempts.map((e) => `${e.homework_id}-${e.student_id}`));
    const nonExemptCount = hwIds.length;
    const submissions = await HomeworkSubmission.findAll({ where: { homework_id: hwIds }, attributes: ['homework_id', 'student_id', 'score', 'status'] });
    const scoreByStudent = {};
    submissions.forEach((s) => {
      if (s.status === 'graded' && s.score != null) {
        const key = `${s.homework_id}-${s.student_id}`;
        if (!exemptSet.has(key)) {
          scoreByStudent[s.student_id] = (scoreByStudent[s.student_id] || 0) + Number(s.score);
        }
      }
    });

    // 3) 期末成绩：最新一条成绩按满分折算百分制
    const exams = await Exam.findAll({ where: { course_id: course.id }, attributes: ['id', 'full_score'] });
    const examScores = await ExamScore.findAll({ where: { exam_id: exams.map((e) => e.id) }, attributes: ['exam_id', 'student_id', 'score'], order: [['id', 'ASC']] });
    const examScoreByStudent = {};
    examScores.forEach((s) => {
      examScoreByStudent[s.student_id] = s;
    });
    const fullByExam = {};
    exams.forEach((e) => {
      fullByExam[e.id] = Number(e.full_score);
    });

    const list = students.map((st) => {
      const sid = Number(st.id);
      const checkinScore = sessionCount === 0 ? 100 : Math.round((((checkinCount[sid] || 0) / sessionCount) * 100) * 10) / 10;
      const homeworkScore = nonExemptCount === 0 ? 100 : Math.round(((scoreByStudent[sid] || 0) / nonExemptCount) * 10) / 10;
      let examScore = null;
      const es = examScoreByStudent[sid];
      if (es) {
        const full = fullByExam[es.exam_id] || 100;
        examScore = Math.round(((Number(es.score) / full) * 100) * 10) / 10;
      }
      const final =
        examScore == null
          ? null
          : Math.round((checkinScore * (cw / 100) + homeworkScore * (hw / 100) + examScore * (ew / 100)) * 10) / 10;
      return {
        student_id: sid,
        name: st.name,
        username: st.username,
        checkinScore,
        homeworkScore,
        examScore,
        final,
      };
    });

    // 排名：有 final 的按降序；无 final 排最后
    const withFinal = list.filter((r) => r.final != null).sort((a, b) => b.final - a.final);
    const withoutFinal = list.filter((r) => r.final == null);
    withFinal.forEach((r, i) => {
      r.rank = i + 1;
    });
    withoutFinal.forEach((r) => {
      r.rank = null;
    });
    const ordered = [...withFinal, ...withoutFinal];

    let me = null;
    if (req.user.role === 'student') {
      const my = ordered.find((r) => Number(r.student_id) === Number(req.user.id));
      me = my || null;
    }
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        list: ordered,
        weights: { checkinWeight: cw, homeworkWeight: hw, examWeight: ew },
        sessionCount,
        homeworkCount: nonExemptCount,
        examCount: exams.length,
        me,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '计算失败：' + e.message, data: null });
  }
}

module.exports = {
  createExam,
  listExams,
  getExamScores,
  saveScores,
  submitScore,
  finalScores,
};
