// 随堂作业控制器
// 覆盖：发布作业（截止时间/格式要求）、学生提交/重交（保留历次）、教师批改/打回/豁免、逾期标识、状态流转
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Homework = require('../models/Homework');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const HomeworkExempt = require('../models/HomeworkExempt');
const Course = require('../models/Course');
const CourseStudent = require('../models/CourseStudent');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

// 校验某用户是否为课程授课教师或管理员
async function isTeacherOrAdmin(course, userId, role) {
  return role === 'admin' || Number(course.teacher_id) === Number(userId);
}

// 校验学生是否在册
async function isEnrolled(courseId, studentId) {
  const c = await CourseStudent.findOne({ where: { course_id: courseId, student_id: studentId } });
  return !!c;
}

// 解析格式要求 JSON
function parseRules(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// ============ 教师：发布作业 ============
async function createHomework(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可发布作业', data: null });
    }
    const { title, description, deadline, formatRules } = req.body;
    if (!title || !title.trim()) return res.json({ code: 400, message: '作业标题不能为空', data: null });
    if (!deadline) return res.json({ code: 400, message: '必须设置提交截止时间', data: null });
    const rulesStr = formatRules ? (typeof formatRules === 'string' ? formatRules : JSON.stringify(formatRules)) : null;
    const homework = await Homework.create({
      course_id: course.id,
      title: title.trim(),
      description: description || '',
      deadline: new Date(deadline),
      format_rules: rulesStr,
      created_by: req.user.id,
    });
    await notificationService.notifyStudents({
      courseId: course.id,
      type: 'homework',
      title: '新作业发布：' + homework.title,
      content: '老师发布了新作业「' + homework.title + '」，请在截止时间前提交。',
      link: '/student/homeworks',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    return res.json({ code: 0, message: '作业发布成功', data: { id: homework.id } });
  } catch (e) {
    return res.json({ code: 500, message: '发布失败：' + e.message, data: null });
  }
}

// ============ 教师/学生：作业列表（教师带统计，学生带我的状态） ============
async function listHomeworks(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    const enrolled = req.user.role === 'student' && !(await isEnrolled(course.id, req.user.id));
    if (req.user.role === 'student' && enrolled) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    // 教师归属校验：非授课教师不可查看他人课程作业列表（防水平越权）
    if (req.user.role === 'teacher' && !(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可查看作业', data: null });
    }
    const homeworks = await Homework.findAll({
      where: { course_id: course.id },
      order: [['created_at', 'DESC']],
    });

    // 在册学生（用于统计）
    const students = await CourseStudent.findAll({ where: { course_id: course.id } });
    const studentCount = students.length;

    if (req.user.role === 'student') {
      // 学生视角：每份作业带我的最新提交与豁免状态
      const list = [];
      for (const hw of homeworks) {
        const sub = await HomeworkSubmission.findOne({
          where: { homework_id: hw.id, student_id: req.user.id },
          order: [['id', 'DESC']],
        });
        const exempt = await HomeworkExempt.findOne({ where: { homework_id: hw.id, student_id: req.user.id } });
        list.push({
          id: hw.id,
          courseId: hw.course_id,
          title: hw.title,
          description: hw.description,
          deadline: hw.deadline,
          formatRules: parseRules(hw.format_rules),
          mySubmission: sub
            ? {
                id: sub.id,
                status: sub.status,
                score: sub.score,
                comment: sub.comment,
                submittedAt: sub.created_at,
                late: sub.created_at > hw.deadline,
              }
            : null,
          exempt: !!exempt,
          isLate: new Date() > new Date(hw.deadline),
        });
      }
      return res.json({ code: 0, message: 'ok', data: { list, studentCount } });
    }

    // 教师视角：带统计
    const list = [];
    for (const hw of homeworks) {
      const subs = await HomeworkSubmission.findAll({
        where: { homework_id: hw.id },
        attributes: ['id', 'student_id', 'status', 'score', 'created_at'],
        order: [['id', 'ASC']],
      });
      // 学生维度最新一条
      const latestByStudent = {};
      subs.forEach((s) => {
        latestByStudent[s.student_id] = s;
      });
      const submittedIds = Object.keys(latestByStudent);
      const gradedCount = submittedIds.filter((sid) => latestByStudent[sid].status === 'graded').length;
      const returnedCount = submittedIds.filter((sid) => latestByStudent[sid].status === 'returned').length;
      const exemptCount = await HomeworkExempt.count({ where: { homework_id: hw.id } });
      list.push({
        id: hw.id,
        title: hw.title,
        description: hw.description,
        deadline: hw.deadline,
        formatRules: parseRules(hw.format_rules),
        createdAt: hw.created_at,
        stats: {
          studentCount,
          submittedCount: submittedIds.length,
          gradedCount,
          returnedCount,
          exemptCount,
        },
        isLate: new Date() > new Date(hw.deadline),
      });
    }
    return res.json({ code: 0, message: 'ok', data: { list, studentCount } });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 教师/学生：作业详情 ============
async function getHomework(req, res) {
  try {
    const homework = await Homework.findByPk(req.params.id);
    if (!homework) return res.json({ code: 404, message: '作业不存在', data: null });
    const course = await Course.findByPk(homework.course_id);
    if (req.user.role === 'student') {
      if (!(await isEnrolled(course.id, req.user.id))) {
        return res.json({ code: 403, message: '你不在该课程中', data: null });
      }
      const sub = await HomeworkSubmission.findOne({
        where: { homework_id: homework.id, student_id: req.user.id },
        order: [['id', 'DESC']],
      });
      const exempt = await HomeworkExempt.findOne({ where: { homework_id: homework.id, student_id: req.user.id } });
      const history = await HomeworkSubmission.findAll({
        where: { homework_id: homework.id, student_id: req.user.id },
        order: [['id', 'DESC']],
      });
      return res.json({
        code: 0,
        message: 'ok',
        data: {
          homework: {
            id: homework.id,
            courseId: homework.course_id,
            title: homework.title,
            description: homework.description,
            deadline: homework.deadline,
            formatRules: parseRules(homework.format_rules),
          },
          mySubmission: sub
            ? {
                id: sub.id,
                content: sub.content,
                attachment: sub.attachment ? JSON.parse(sub.attachment) : null,
                status: sub.status,
                score: sub.score,
                comment: sub.comment,
                submittedAt: sub.created_at,
                gradedAt: sub.graded_at,
                late: sub.created_at > homework.deadline,
              }
            : null,
          exempt: !!exempt,
          history: history.map((h) => ({
            id: h.id,
            status: h.status,
            score: h.score,
            comment: h.comment,
            submittedAt: h.created_at,
          })),
        },
      });
    }
    // 教师：在册学生 × 最新提交 + 豁免
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可查看', data: null });
    }
    const courseWithStudents = await Course.findByPk(course.id, {
      include: [{ model: User, as: 'students', attributes: ['id', 'username', 'name'] }],
    });
    const students = courseWithStudents.students || [];
    const subs = await HomeworkSubmission.findAll({
      where: { homework_id: homework.id },
      order: [['id', 'ASC']],
    });
    const latestByStudent = {};
    subs.forEach((s) => {
      latestByStudent[s.student_id] = s;
    });
    const exempts = await HomeworkExempt.findAll({ where: { homework_id: homework.id } });
    const exemptIds = new Set(exempts.map((e) => Number(e.student_id)));
    const rows = [];
    for (const st of students) {
      const sid = Number(st.id);
      const sub = latestByStudent[sid] || null;
      rows.push({
        studentId: sid,
        name: st.name,
        username: st.username,
        submission: sub
          ? {
              id: sub.id,
              content: sub.content,
              attachment: sub.attachment ? JSON.parse(sub.attachment) : null,
              status: sub.status,
              score: sub.score,
              comment: sub.comment,
              submittedAt: sub.created_at,
              gradedAt: sub.graded_at,
              late: sub.created_at > homework.deadline,
            }
          : null,
        exempt: exemptIds.has(sid),
        exemptReason: (exempts.find((e) => Number(e.student_id) === sid) || {}).reason || '',
      });
    }
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        homework: {
          id: homework.id,
          courseId: homework.course_id,
          title: homework.title,
          description: homework.description,
          deadline: homework.deadline,
          formatRules: parseRules(homework.format_rules),
        },
        rows,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '加载失败：' + e.message, data: null });
  }
}

// ============ 教师：修改作业（截止前可调整） ============
async function updateHomework(req, res) {
  try {
    const homework = await Homework.findByPk(req.params.id);
    if (!homework) return res.json({ code: 404, message: '作业不存在', data: null });
    const course = await Course.findByPk(homework.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可修改', data: null });
    }
    const { title, description, deadline, formatRules } = req.body;
    if (title !== undefined && (!title || !title.trim())) {
      return res.json({ code: 400, message: '作业标题不能为空', data: null });
    }
    const patch = {};
    if (title !== undefined) patch.title = title.trim();
    if (description !== undefined) patch.description = description;
    if (deadline !== undefined) {
      if (!deadline) return res.json({ code: 400, message: '截止时间不能为空', data: null });
      patch.deadline = new Date(deadline);
    }
    if (formatRules !== undefined) {
      patch.format_rules = typeof formatRules === 'string' ? formatRules : JSON.stringify(formatRules);
    }
    await homework.update(patch);
    return res.json({ code: 0, message: '作业已更新', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '更新失败：' + e.message, data: null });
  }
}

// ============ 教师：删除作业（级联删除提交与豁免） ============
async function deleteHomework(req, res) {
  try {
    const homework = await Homework.findByPk(req.params.id);
    if (!homework) return res.json({ code: 404, message: '作业不存在', data: null });
    const course = await Course.findByPk(homework.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可删除', data: null });
    }
    await sequelize.transaction(async (t) => {
      await HomeworkSubmission.destroy({ where: { homework_id: homework.id }, transaction: t });
      await HomeworkExempt.destroy({ where: { homework_id: homework.id }, transaction: t });
      await homework.destroy({ transaction: t });
    });
    return res.json({ code: 0, message: '作业已删除', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '删除失败：' + e.message, data: null });
  }
}

// ============ 学生：提交/重新提交作业 ============
async function submitHomework(req, res) {
  try {
    const homework = await Homework.findByPk(req.params.id);
    if (!homework) return res.json({ code: 404, message: '作业不存在', data: null });
    const course = await Course.findByPk(homework.course_id);
    if (req.user.role !== 'student') return res.json({ code: 403, message: '仅学生可提交作业', data: null });
    if (!(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '你不在该课程中', data: null });
    }
    const exempt = await HomeworkExempt.findOne({ where: { homework_id: homework.id, student_id: req.user.id } });
    if (exempt) return res.json({ code: 400, message: '你已被豁免本次作业，无需提交', data: null });

    const now = Date.now();
    const deadline = new Date(homework.deadline).getTime();
    if (now > deadline) return res.json({ code: 400, message: '已过提交截止时间，无法提交', data: null });

    const { content, attachment } = req.body;
    if ((!content || !content.trim()) && !attachment) {
      return res.json({ code: 400, message: '提交内容不能为空', data: null });
    }
    const sub = await HomeworkSubmission.create({
      homework_id: homework.id,
      student_id: req.user.id,
      content: content || '',
      attachment: attachment ? JSON.stringify(attachment) : null,
      status: 'submitted',
    });
    await notificationService.notifyTeacher({
      courseId: course.id,
      type: 'homework',
      title: '学生提交作业：' + homework.title,
      content: '学生已提交作业「' + homework.title + '」，请及时批改。',
      link: '/teacher/homeworks',
      senderId: req.user.id,
      senderRole: 'student',
    });
    return res.json({ code: 0, message: '提交成功，等待教师批改', data: { id: sub.id } });
  } catch (e) {
    return res.json({ code: 500, message: '提交失败：' + e.message, data: null });
  }
}

// ============ 教师：批改作业 ============
async function gradeSubmission(req, res) {
  try {
    const homework = await Homework.findByPk(req.params.id);
    if (!homework) return res.json({ code: 404, message: '作业不存在', data: null });
    const course = await Course.findByPk(homework.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可批改', data: null });
    }
    const { studentId, score, comment } = req.body;
    if (!studentId) return res.json({ code: 400, message: '缺少学生', data: null });
    if (score === undefined || score === null || Number(score) < 0 || Number(score) > 100) {
      return res.json({ code: 400, message: '分数需在 0-100 之间', data: null });
    }
    const sub = await HomeworkSubmission.findOne({
      where: { homework_id: homework.id, student_id: studentId },
      order: [['id', 'DESC']],
    });
    if (!sub) return res.json({ code: 400, message: '该学生尚未提交作业', data: null });
    await sub.update({
      status: 'graded',
      score: Number(score),
      comment: comment || '',
      graded_at: new Date(),
    });
    await notificationService.notifyUser({
      userId: studentId,
      courseId: course.id,
      type: 'homework',
      title: '作业已批改：' + homework.title,
      content: '老师已批改你的作业「' + homework.title + '」，得分 ' + Number(score) + ' 分。',
      link: '/student/homeworks',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    return res.json({ code: 0, message: '批改完成', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '批改失败：' + e.message, data: null });
  }
}

// ============ 教师：打回重交 ============
async function returnSubmission(req, res) {
  try {
    const homework = await Homework.findByPk(req.params.id);
    if (!homework) return res.json({ code: 404, message: '作业不存在', data: null });
    const course = await Course.findByPk(homework.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可打回', data: null });
    }
    const { studentId, comment } = req.body;
    if (!studentId) return res.json({ code: 400, message: '缺少学生', data: null });
    const sub = await HomeworkSubmission.findOne({
      where: { homework_id: homework.id, student_id: studentId },
      order: [['id', 'DESC']],
    });
    if (!sub) return res.json({ code: 400, message: '该学生尚未提交作业', data: null });
    await sub.update({ status: 'returned', comment: comment || '', graded_at: new Date() });
    await notificationService.notifyUser({
      userId: studentId,
      courseId: course.id,
      type: 'homework',
      title: '作业已打回：' + homework.title,
      content: '老师已打回你的作业「' + homework.title + '」，请修改后重新提交。',
      link: '/student/homeworks',
      senderId: req.user.id,
      senderRole: 'teacher',
    });
    return res.json({ code: 0, message: '已打回，学生可修改后重新提交', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '打回失败：' + e.message, data: null });
  }
}

// ============ 教师：豁免/取消豁免 ============
async function exemptStudent(req, res) {
  try {
    const homework = await Homework.findByPk(req.params.id);
    if (!homework) return res.json({ code: 404, message: '作业不存在', data: null });
    const course = await Course.findByPk(homework.course_id);
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师可豁免', data: null });
    }
    const { studentId, exempt, reason } = req.body;
    if (!studentId) return res.json({ code: 400, message: '缺少学生', data: null });
    if (exempt) {
      const exist = await HomeworkExempt.findOne({ where: { homework_id: homework.id, student_id: studentId } });
      if (!exist) {
        await HomeworkExempt.create({ homework_id: homework.id, student_id: studentId, reason: reason || '' });
      }
      return res.json({ code: 0, message: '已豁免该学生，豁免作业不计入作业平均分', data: null });
    }
    await HomeworkExempt.destroy({ where: { homework_id: homework.id, student_id: studentId } });
    return res.json({ code: 0, message: '已取消豁免', data: null });
  } catch (e) {
    return res.json({ code: 500, message: '操作失败：' + e.message, data: null });
  }
}

module.exports = {
  createHomework,
  listHomeworks,
  getHomework,
  updateHomework,
  deleteHomework,
  submitHomework,
  gradeSubmission,
  returnSubmission,
  exemptStudent,
};
