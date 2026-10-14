// 学情调查控制器
// 覆盖：教师发起调查（知识点+反馈形式[6档/自定义选项]+可选截止）、学生反馈、实时统计、关闭/删除
const sequelize = require('../config/database');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const Course = require('../models/Course');
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

function parseOptions(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// ============ 教师：发起学情调查 ============
async function createSurvey(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可发起调查', data: null });
    }
    const { knowledgePoint, useEmotion, options, deadline, sessionId } = req.body;
    if (!knowledgePoint || !knowledgePoint.trim()) {
      return res.json({ code: 400, message: '必须填写调查的知识点', data: null });
    }
    if (useEmotion === false) {
      const opts = Array.isArray(options) ? options.filter((o) => o && o.trim()) : [];
      if (opts.length < 2) {
        return res.json({ code: 400, message: '自定义选项至少需要 2 个', data: null });
      }
    }
    const survey = await Survey.create({
      course_id: course.id,
      session_id: sessionId || null,
      knowledge_point: knowledgePoint.trim(),
      use_emotion: useEmotion !== false,
      options: useEmotion === false ? JSON.stringify(options.filter((o) => o && o.trim())) : null,
      deadline: deadline ? new Date(deadline) : null,
      created_by: req.user.id,
    });
    await notificationService.notifyStudents({
      courseId: course.id,
      type: 'survey',
      title: '新学情调查：' + survey.knowledge_point,
      content: '老师发起了关于「' + survey.knowledge_point + '」的学情调查，请及时反馈。',
      link: '/student/surveys',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    return res.json({ code: 0, message: '学情调查已发起', data: { id: survey.id } });
  } catch (e) {
    return res.json({ code: 500, message: '发起失败：' + e.message, data: null });
  }
}

// ============ 教师/学生：调查列表 ============
async function listSurveys(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (req.user.role === 'student' && !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    const surveys = await Survey.findAll({
      where: { course_id: course.id },
      order: [['created_at', 'DESC']],
    });

    if (req.user.role === 'student') {
      const list = [];
      for (const s of surveys) {
        const resp = await SurveyResponse.findOne({
          where: { survey_id: s.id, student_id: req.user.id },
          order: [['id', 'DESC']],
        });
        const deadlinePassed = s.deadline && new Date(s.deadline).getTime() < Date.now();
        list.push({
          id: s.id,
          knowledgePoint: s.knowledge_point,
          useEmotion: s.use_emotion,
          options: parseOptions(s.options),
          deadline: s.deadline,
          status: s.status,
          isClosed: s.status === 'closed' || deadlinePassed,
          myResponse: resp
            ? {
                score: resp.score,
                answer: resp.answer,
                submittedAt: resp.created_at,
              }
            : null,
        });
      }
      return res.json({ code: 0, message: 'ok', data: { list } });
    }

    // 教师：带参与统计
    const list = [];
    for (const s of surveys) {
      const responses = await SurveyResponse.findAll({ where: { survey_id: s.id }, attributes: ['student_id', 'score', 'answer'] });
      const latest = {};
      responses.forEach((r) => {
        latest[r.student_id] = r;
      });
      const participantIds = Object.keys(latest);
      const scores = participantIds.map((sid) => latest[sid].score).filter((v) => v != null);
      const deadlinePassed = s.deadline && new Date(s.deadline).getTime() < Date.now();
      list.push({
        id: s.id,
        knowledgePoint: s.knowledge_point,
        useEmotion: s.use_emotion,
        options: parseOptions(s.options),
        deadline: s.deadline,
        status: s.status,
        isClosed: s.status === 'closed' || deadlinePassed,
        stats: {
          participantCount: participantIds.length,
          avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
        },
      });
    }
    return res.json({ code: 0, message: 'ok', data: { list } });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 教师/学生：调查详情 ============
async function getSurvey(req, res) {
  try {
    const survey = await Survey.findByPk(req.params.id);
    if (!survey) return res.json({ code: 404, message: '调查不存在', data: null });
    const course = await Course.findByPk(survey.course_id);
    const base = {
      id: survey.id,
      courseId: survey.course_id,
      sessionId: survey.session_id,
      knowledgePoint: survey.knowledge_point,
      useEmotion: survey.use_emotion,
      options: parseOptions(survey.options),
      deadline: survey.deadline,
      status: survey.status,
      isClosed: survey.status === 'closed' || (survey.deadline && new Date(survey.deadline).getTime() < Date.now()),
    };

    if (req.user.role === 'student') {
      if (!(await isEnrolled(course.id, req.user.id))) {
        return res.json({ code: 403, message: '你不在该课程中', data: null });
      }
      const resp = await SurveyResponse.findOne({
        where: { survey_id: survey.id, student_id: req.user.id },
        order: [['id', 'DESC']],
      });
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          survey: base,
          myResponse: resp ? { score: resp.score, answer: resp.answer, submittedAt: resp.created_at } : null,
        },
      });
    }

    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可查看', data: null });
    }
    const courseWithStudents = await Course.findByPk(course.id, {
      include: [{ model: User, as: 'students', attributes: ['id', 'username', 'name'] }],
    });
    const students = courseWithStudents.students || [];
    const responses = await SurveyResponse.findAll({ where: { survey_id: survey.id }, order: [['id', 'ASC']] });
    const latestByStudent = {};
    responses.forEach((r) => {
      latestByStudent[r.student_id] = r;
    });
    const participantIds = new Set(Object.keys(latestByStudent).map(Number));
    const rows = students.map((st) => {
      const resp = latestByStudent[st.id] || null;
      return {
        studentId: Number(st.id),
        name: st.name,
        username: st.username,
        response: resp
          ? { score: resp.score, answer: resp.answer, submittedAt: resp.created_at }
          : null,
      };
    });
    return res.json({
      code: 0,
      message: 'ok',
      data: { survey: base, rows, participantCount: participantIds.size },
    });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 学生：反馈/修改反馈 ============
async function respondSurvey(req, res) {
  try {
    const survey = await Survey.findByPk(req.params.id);
    if (!survey) return res.json({ code: 404, message: '调查不存在', data: null });
    const course = await Course.findByPk(survey.course_id);
    if (req.user.role !== 'student') return res.json({ code: 403, message: '仅学生可反馈', data: null });
    if (!(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    const deadlinePassed = survey.deadline && new Date(survey.deadline).getTime() < Date.now();
    if (survey.status === 'closed' || deadlinePassed) {
      return res.json({ code: 400, message: '该调查已结束，无法反馈', data: null });
    }
    const { score, answer } = req.body;
    if (survey.use_emotion) {
      if (!score || Number(score) < 1 || Number(score) > 6) {
        return res.json({ code: 400, message: '请选择 1-6 档理解程度', data: null });
      }
      await SurveyResponse.create({ survey_id: survey.id, student_id: req.user.id, score: Number(score) });
    } else {
      if (!answer || !String(answer).trim()) {
        return res.json({ code: 400, message: '请选择一个选项', data: null });
      }
      await SurveyResponse.create({ survey_id: survey.id, student_id: req.user.id, answer: String(answer).trim() });
    }
    return res.json({ code: 0, message: '反馈已提交', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '提交失败：' + e.message, data: null });
  }
}

// ============ 教师：实时统计 ============
async function surveyStats(req, res) {
  try {
    const survey = await Survey.findByPk(req.params.id);
    if (!survey) return res.json({ code: 404, message: '调查不存在', data: null });
    const course = await Course.findByPk(survey.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可查看统计', data: null });
    }
    const courseWithStudents = await Course.findByPk(course.id, {
      include: [{ model: User, as: 'students', attributes: ['id', 'username', 'name'] }],
    });
    const students = courseWithStudents.students || [];
    const responses = await SurveyResponse.findAll({ where: { survey_id: survey.id }, order: [['id', 'ASC']] });
    const latestByStudent = {};
    responses.forEach((r) => {
      latestByStudent[r.student_id] = r;
    });
    const totalStudents = students.length;
    const respondedIds = Object.keys(latestByStudent).map(Number);
    const respondedStudents = students
      .filter((st) => respondedIds.includes(Number(st.id)))
      .map((st) => ({
        student_id: Number(st.id),
        name: st.name,
        username: st.username,
        response: latestByStudent[st.id]
          ? { score: latestByStudent[st.id].score, answer: latestByStudent[st.id].answer }
          : null,
      }));
    const unrespondedStudents = students
      .filter((st) => !respondedIds.includes(Number(st.id)))
      .map((st) => ({ student_id: Number(st.id), name: st.name, username: st.username }));

    let distribution = null;
    let avgScore = null;
    let optionCounts = null;
    if (survey.use_emotion) {
      distribution = [0, 0, 0, 0, 0, 0];
      const scores = [];
      respondedIds.forEach((sid) => {
        const sc = latestByStudent[sid].score;
        if (sc != null) {
          distribution[sc - 1] += 1;
          scores.push(sc);
        }
      });
      if (scores.length) {
        avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      }
    } else {
      const opts = parseOptions(survey.options);
      optionCounts = opts.map((o) => ({
        option: o,
        count: respondedIds.filter((sid) => latestByStudent[sid].answer === o).length,
      }));
    }
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        survey: {
          id: survey.id,
          knowledgePoint: survey.knowledge_point,
          useEmotion: survey.use_emotion,
          options: parseOptions(survey.options),
          status: survey.status,
          deadline: survey.deadline,
        },
        totalStudents,
        respondedCount: respondedIds.length,
        unrespondedCount: totalStudents - respondedIds.length,
        respondedStudents,
        unrespondedStudents,
        distribution,
        avgScore,
        optionCounts,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '统计失败：' + e.message, data: null });
  }
}

// ============ 教师：关闭调查 ============
async function closeSurvey(req, res) {
  try {
    const survey = await Survey.findByPk(req.params.id);
    if (!survey) return res.json({ code: 404, message: '调查不存在', data: null });
    const course = await Course.findByPk(survey.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可关闭', data: null });
    }
    if (survey.status === 'closed') return res.json({ code: 400, message: '该调查已关闭', data: null });
    await survey.update({ status: 'closed' });
    return res.json({ code: 0, message: '调查已关闭，学生无法继续反馈', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '关闭失败：' + e.message, data: null });
  }
}

// ============ 教师：删除调查 ============
async function deleteSurvey(req, res) {
  try {
    const survey = await Survey.findByPk(req.params.id);
    if (!survey) return res.json({ code: 404, message: '调查不存在', data: null });
    const course = await Course.findByPk(survey.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可删除', data: null });
    }
    await sequelize.transaction(async (t) => {
      await SurveyResponse.destroy({ where: { survey_id: survey.id }, transaction: t });
      await survey.destroy({ transaction: t });
    });
    return res.json({ code: 0, message: '调查已删除', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '删除失败：' + e.message, data: null });
  }
}

module.exports = {
  createSurvey,
  listSurveys,
  getSurvey,
  respondSurvey,
  surveyStats,
  closeSurvey,
  deleteSurvey,
};
