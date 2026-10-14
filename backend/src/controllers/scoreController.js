// 成绩管理控制器
// 覆盖：学生查看个人各项成绩明细（只读）、教师/管理员查看班级成绩明细、
//      修改作业/期末成绩（必填原因、留痕）、变更留痕列表
const sequelize = require('../config/database');
const Course = require('../models/Course');
const ScoreWeight = require('../models/ScoreWeight');
const ClassSession = require('../models/ClassSession');
const Checkin = require('../models/Checkin');
const CheckinRecord = require('../models/CheckinRecord');
const Homework = require('../models/Homework');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const HomeworkExempt = require('../models/HomeworkExempt');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const Exam = require('../models/Exam');
const ExamScore = require('../models/ExamScore');
const ScoreChange = require('../models/ScoreChange');
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

// ============ 学生：我的成绩明细（只读） ============
async function getMyScores(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (req.user.role !== 'student' || !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '仅本课程学生可查看', data: null });
    }
    const sid = req.user.id;

    // 签到：出勤率（正常+补签）/ 会话数
    const sessions = await ClassSession.findAll({ where: { course_id: course.id }, attributes: ['id'] });
    const sessionCount = sessions.length;
    const checkinActs = await Checkin.findAll({ where: { session_id: sessions.map((s) => s.id) }, attributes: ['id'] });
    let myCheckins = [];
    if (checkinActs.length) {
      myCheckins = await CheckinRecord.findAll({
        where: { checkin_id: checkinActs.map((c) => c.id), student_id: sid },
        attributes: ['type'],
      });
    }
    const present = myCheckins.filter((c) => c.type === 'normal' || c.type === 'makeup' || c.type === 'late').length; // 迟到计入到课
    const checkinScore = sessionCount === 0 ? 100 : Math.round((present / sessionCount) * 1000) / 10;

    // 作业：每次作业得分/状态/豁免
    const homeworks = await Homework.findAll({ where: { course_id: course.id }, order: [['created_at', 'ASC']] });
    const hwRows = [];
    for (const h of homeworks) {
      const exempt = await HomeworkExempt.findOne({ where: { homework_id: h.id, student_id: sid } });
      const sub = await HomeworkSubmission.findOne({
        where: { homework_id: h.id, student_id: sid },
        order: [['id', 'DESC']],
      });
      hwRows.push({
        id: h.id,
        name: h.title,
        score: sub && sub.status === 'graded' ? Number(sub.score) : null,
        status: sub ? sub.status : 'none',
        exempt: !!exempt,
      });
    }

    // 调查：参与率（参与调查数/已发布调查数）
    const surveys = await Survey.findAll({ where: { course_id: course.id }, attributes: ['id'] });
    let surveyParticipated = 0;
    if (surveys.length) {
      const mySurveyResponses = await SurveyResponse.count({
        where: { survey_id: surveys.map((s) => s.id), student_id: sid },
        distinct: true,
        col: 'survey_id',
      });
      surveyParticipated = mySurveyResponses;
    }

    // 期末：每门考试得分/确认状态
    const exams = await Exam.findAll({ where: { course_id: course.id }, order: [['exam_time', 'ASC']] });
    const examRows = [];
    for (const e of exams) {
      const my = await ExamScore.findOne({ where: { exam_id: e.id, student_id: sid } });
      examRows.push({
        id: e.id,
        name: e.name,
        fullScore: Number(e.full_score),
        form: e.form,
        score: my ? Number(my.score) : null,
        source: my ? my.source : null,
      });
    }

    return res.json({
      code: 0,
      message: 'ok',
      data: {
        checkin: { sessionCount, presentCount: present, score: checkinScore },
        homeworks: hwRows,
        surveys: { total: surveys.length, participated: surveyParticipated },
        exams: examRows,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 教师/管理员：班级成绩明细 ============
async function getCourseScores(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师/管理员可查看', data: null });
    }
    const courseWithStudents = await Course.findByPk(course.id, {
      include: [{ model: User, as: 'students', attributes: ['id', 'username', 'name'] }],
    });
    const students = courseWithStudents.students || [];
    const stuMap = {};
    students.forEach((s) => {
      stuMap[s.id] = s;
    });

    // 作业明细（每门作业每个学生）
    const homeworks = await Homework.findAll({ where: { course_id: course.id }, order: [['created_at', 'ASC']] });
    const homeworkRows = [];
    for (const h of homeworks) {
      const subs = await HomeworkSubmission.findAll({ where: { homework_id: h.id }, order: [['id', 'ASC']] });
      const latest = {};
      subs.forEach((s) => {
        latest[s.student_id] = s;
      });
      const exempts = await HomeworkExempt.findAll({ where: { homework_id: h.id } });
      const exemptSet = new Set(exempts.map((e) => e.student_id));
      homeworkRows.push({
        id: h.id,
        name: h.title,
        rows: students.map((st) => ({
          student_id: Number(st.id),
          name: st.name,
          username: st.username,
          score: latest[st.id] && latest[st.id].status === 'graded' ? Number(latest[st.id].score) : null,
          status: latest[st.id] ? latest[st.id].status : 'none',
          exempt: exemptSet.has(Number(st.id)),
        })),
      });
    }

    // 期末明细（每门考试每个学生）
    const exams = await Exam.findAll({ where: { course_id: course.id }, order: [['exam_time', 'ASC']] });
    const examRows = [];
    for (const e of exams) {
      const scores = await ExamScore.findAll({ where: { exam_id: e.id } });
      const byStudent = {};
      scores.forEach((s) => {
        byStudent[s.student_id] = s;
      });
      examRows.push({
        id: e.id,
        name: e.name,
        fullScore: Number(e.full_score),
        form: e.form,
        rows: students.map((st) => ({
          student_id: Number(st.id),
          name: st.name,
          username: st.username,
          score: byStudent[st.id] ? Number(byStudent[st.id].score) : null,
          source: byStudent[st.id] ? byStudent[st.id].source : null,
        })),
      });
    }

    return res.json({ code: 0, message: 'ok', data: { homeworks: homeworkRows, exams: examRows } });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 教师/管理员：修改成绩（必填原因，留痕） ============
async function updateScore(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师/管理员可修改成绩', data: null });
    }
    const itemType = req.params.itemType; // homework | exam
    const { studentId, score, reason, refId } = req.body;
    if (!studentId || score === undefined || score === null || score === '') {
      return res.json({ code: 400, message: '请填写学生与成绩', data: null });
    }
    if (!reason || !reason.trim()) {
      return res.json({ code: 400, message: '修改成绩必须填写原因', data: null });
    }
    const newScore = Number(score);
    if (Number.isNaN(newScore) || newScore < 0) {
      return res.json({ code: 400, message: '成绩不合法', data: null });
    }
    const stu = await User.findByPk(studentId);
    if (!stu || stu.role !== 'student') return res.json({ code: 400, message: '学生不存在', data: null });
    if (!(await isEnrolled(course.id, studentId))) {
      return res.json({ code: 400, message: '该学生不在本课程中', data: null });
    }

    let oldScore = null;
    let refName = '';
    if (itemType === 'homework') {
      if (!refId) return res.json({ code: 400, message: '缺少作业', data: null });
      const hw = await Homework.findByPk(refId);
      if (!hw || Number(hw.course_id) !== Number(course.id)) return res.json({ code: 400, message: '作业不存在', data: null });
      if (newScore > 100) return res.json({ code: 400, message: '作业成绩不能超过 100', data: null });
      refName = hw.title;
      const sub = await HomeworkSubmission.findOne({
        where: { homework_id: refId, student_id: studentId },
        order: [['id', 'DESC']],
      });
      if (!sub) return res.json({ code: 400, message: '该学生未提交此作业，无法打分', data: null });
      oldScore = sub.status === 'graded' && sub.score != null ? Number(sub.score) : null;
      await sub.update({ score: newScore, status: 'graded' });
    } else if (itemType === 'exam') {
      if (!refId) return res.json({ code: 400, message: '缺少考试', data: null });
      const exam = await Exam.findByPk(refId);
      if (!exam || Number(exam.course_id) !== Number(course.id)) return res.json({ code: 400, message: '考试不存在', data: null });
      if (newScore > Number(exam.full_score)) {
        return res.json({ code: 400, message: `成绩不能超过满分 ${Number(exam.full_score)}`, data: null });
      }
      refName = exam.name;
      const [row] = await ExamScore.findOrCreate({
        where: { exam_id: refId, student_id: studentId },
        defaults: { exam_id: refId, student_id: studentId, score: newScore, source: 'teacher' },
      });
      oldScore = Number(row.score);
      await row.update({ score: newScore, source: 'teacher' });
    } else {
      return res.json({ code: 400, message: '不支持的成绩类型', data: null });
    }

    await ScoreChange.create({
      course_id: course.id,
      item_type: itemType,
      ref_id: refId,
      ref_name: refName,
      student_id: studentId,
      old_score: oldScore,
      new_score: newScore,
      reason: reason.trim(),
      operator_id: req.user.id,
    });
    await notificationService.notifyUser({
      userId: studentId,
      courseId: course.id,
      type: 'score',
      title: '成绩已修改：' + refName,
      content: '「' + refName + '」成绩由 ' + (oldScore != null ? oldScore : '-') + ' 调整为 ' + newScore + '，原因：' + reason.trim() + '。',
      link: '/student/scores',
      senderId: req.user.id,
      senderRole: req.user.role === 'admin' ? 'admin' : 'teacher',
    });
    return res.json({ code: 0, message: '成绩已修改并记录变更', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '修改失败：' + e.message, data: null });
  }
}

// ============ 教师/管理员：变更留痕列表 ============
async function getScoreChanges(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师/管理员可查看', data: null });
    }
    const changes = await ScoreChange.findAll({
      where: { course_id: course.id },
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'student', attributes: ['name', 'username'] },
        { model: User, as: 'operator', attributes: ['name', 'username'] },
      ],
    });
    const list = changes.map((c) => ({
      id: c.id,
      itemType: c.item_type,
      refName: c.ref_name,
      studentName: c.student ? c.student.name : '-',
      oldScore: c.old_score != null ? Number(c.old_score) : null,
      newScore: Number(c.new_score),
      reason: c.reason,
      operatorName: c.operator ? c.operator.name : '-',
      createdAt: c.created_at,
    }));
    return res.json({ code: 0, message: 'ok', data: { list } });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

module.exports = {
  getMyScores,
  getCourseScores,
  updateScore,
  getScoreChanges,
};
