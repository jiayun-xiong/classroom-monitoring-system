// 课堂项目控制器：创建/列表/详情/更新/加入/二维码/刷新课堂码/权重/删除归档
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const Course = require('../models/Course');
const CourseStudent = require('../models/CourseStudent');
const ScoreWeight = require('../models/ScoreWeight');
const User = require('../models/User');
const ClassSession = require('../models/ClassSession');
const Homework = require('../models/Homework');
const Survey = require('../models/Survey');
const Exam = require('../models/Exam');
const EmotionRound = require('../models/EmotionRound');
const ScoreChange = require('../models/ScoreChange');

// 生成 6 位课堂码（数字+大写字母，避免易混淆字符 0/O/1/I）
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function generateJoinCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// 确保课堂码唯一（冲突则重新生成，最多 5 次）
async function uniqueJoinCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateJoinCode();
    const exists = await Course.findOne({ where: { join_code: code } });
    if (!exists) return code;
  }
  throw new Error('课堂码生成失败，请重试');
}

// 默认有效期：24 小时
function defaultExpire() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

// 教师创建课堂（返回课堂码）
async function createCourse(req, res) {
  try {
    const { name, semester, weeks, scheduleTime, location, credit, weights } = req.body;
    if (!name) {
      return res.json({ code: 400, message: '课程名称必填', data: null });
    }
    const creditNum = credit === undefined ? 3.0 : Number(credit);
    if (isNaN(creditNum) || creditNum <= 0 || creditNum > 99) {
      return res.json({ code: 400, message: '学分必须为大于 0 且不超过 99 的数字', data: null });
    }
    const join_code = await uniqueJoinCode();
    const course = await Course.create({
      name,
      teacher_id: req.user.id,
      semester: semester || null,
      weeks: weeks || null,
      schedule_time: scheduleTime || null,
      location: location || null,
      credit: creditNum,
      join_code,
      join_code_expire: defaultExpire(),
    });
    // 权重：默认 签到20 / 作业20 / 期末60；可随创建传入
    await ScoreWeight.create({
      course_id: course.id,
      checkin_weight: weights?.checkinWeight ?? 20,
      homework_weight: weights?.homeworkWeight ?? 20,
      exam_weight: weights?.examWeight ?? 60,
    });
    res.json({ code: 0, message: '创建成功', data: { id: course.id, joinCode: join_code } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 课程列表（教师：我创建的；学生：我加入的）
async function listCourses(req, res) {
  try {
    const role = req.user.role;
    if (role === 'teacher') {
      const list = await Course.findAll({
        where: { teacher_id: req.user.id, status: 'active' },
        include: [{ model: ScoreWeight, as: 'weights' }],
        order: [['id', 'DESC']],
      });
      return res.json({ code: 0, message: 'ok', data: { list } });
    }
    if (role === 'student') {
      const list = await Course.findAll({
        where: { status: 'active' },
        include: [
          { model: ScoreWeight, as: 'weights' },
          { model: User, as: 'students', where: { id: req.user.id }, attributes: [] },
          { model: User, as: 'teacher', attributes: ['id', 'username', 'name'] },
        ],
        order: [['id', 'DESC']],
      });
      return res.json({ code: 0, message: 'ok', data: { list } });
    }
    // 管理员：全部课程（含授课教师与学生数）
    const list = await Course.findAll({
      where: { status: 'active' },
      include: [
        { model: ScoreWeight, as: 'weights' },
        { model: User, as: 'teacher', attributes: ['id', 'username', 'name'] },
        { model: User, as: 'students', attributes: ['id', 'username', 'name'], through: { attributes: [] } },
      ],
      order: [['id', 'DESC']],
    });
    res.json({ code: 0, message: 'ok', data: { list } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 课程详情（教师/学生成员/管理员）
async function getCourse(req, res) {
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id, {
      include: [
        { model: User, as: 'teacher', attributes: ['id', 'username', 'name'] },
        { model: User, as: 'students', attributes: ['id', 'username', 'name', 'phone'], through: { attributes: ['joined_at'] } },
        { model: ScoreWeight, as: 'weights' },
      ],
    });
    if (!course) {
      return res.json({ code: 404, message: '课堂不存在', data: null });
    }
    if (course.status === 'archived') {
      return res.json({ code: 404, message: '课堂不存在', data: null });
    }
    // 权限：教师本人 / 课程学生 / 管理员
    if (req.user.role === 'teacher' && course.teacher_id !== req.user.id) {
      return res.json({ code: 403, message: '无权限查看该课堂', data: null });
    }
    if (req.user.role === 'student') {
      const enrolled = await CourseStudent.findOne({ where: { course_id: id, student_id: req.user.id } });
      if (!enrolled) {
        return res.json({ code: 403, message: '尚未加入该课堂', data: null });
      }
    }
    res.json({ code: 0, message: 'ok', data: { course } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师更新课程信息
async function updateCourse(req, res) {
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (course.teacher_id !== req.user.id) {
      return res.json({ code: 403, message: '仅授课教师可修改', data: null });
    }
    const { name, semester, weeks, scheduleTime, location, credit } = req.body;
    if (credit !== undefined) {
      const creditNum = Number(credit);
      if (isNaN(creditNum) || creditNum <= 0 || creditNum > 99) {
        return res.json({ code: 400, message: '学分必须为大于 0 且不超过 99 的数字', data: null });
      }
    }
    await course.update({
      name: name ?? course.name,
      semester: semester !== undefined ? semester : course.semester,
      weeks: weeks !== undefined ? weeks : course.weeks,
      schedule_time: scheduleTime !== undefined ? scheduleTime : course.schedule_time,
      location: location !== undefined ? location : course.location,
      credit: credit !== undefined ? Number(credit) : course.credit,
    });
    res.json({ code: 0, message: '更新成功', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 学生通过课堂码加入
async function joinCourse(req, res) {
  try {
    const { joinCode } = req.body;
    if (!joinCode) {
      return res.json({ code: 400, message: '请输入课堂码', data: null });
    }
    const course = await Course.findOne({ where: { join_code: joinCode.toUpperCase().trim() } });
    if (!course) {
      return res.json({ code: 404, message: '课堂码不存在，请确认后重试', data: null });
    }
    const exists = await CourseStudent.findOne({ where: { course_id: course.id, student_id: req.user.id } });
    if (exists) {
      return res.json({ code: 400, message: '你已加入该课堂', data: null });
    }
    await CourseStudent.create({ course_id: course.id, student_id: req.user.id });
    res.json({ code: 0, message: '加入成功', data: { id: course.id, name: course.name } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 生成课堂二维码（内容为加入链接，含课堂码）
async function getQrcode(req, res) {
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.json({ code: 403, message: '仅教师可查看二维码', data: null });
    }
    const content = JSON.stringify({ type: 'course_join', courseId: course.id, joinCode: course.join_code });
    const qrcodeUrl = await QRCode.toDataURL(content);
    res.json({ code: 0, message: 'ok', data: { qrcodeUrl, joinCode: course.join_code, expire: course.join_code_expire } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师刷新课堂码（新码 + 24h 有效期）
async function refreshCode(req, res) {
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
      return res.json({ code: 403, message: '仅管理员可刷新课堂码', data: null });
    }
    const join_code = await uniqueJoinCode();
    const expire = defaultExpire();
    await course.update({ join_code, join_code_expire: expire });
    res.json({ code: 0, message: '课堂码已刷新', data: { joinCode: join_code, expire } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师设置成绩权重（校验三项和 = 100）
async function updateWeights(req, res) {
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (course.teacher_id !== req.user.id) {
      return res.json({ code: 403, message: '仅授课教师可设置权重', data: null });
    }
    const { checkinWeight, homeworkWeight, examWeight } = req.body;
    const cw = Number(checkinWeight);
    const hw = Number(homeworkWeight);
    const ew = Number(examWeight);
    if ([cw, hw, ew].some((n) => isNaN(n) || n < 0)) {
      return res.json({ code: 400, message: '权重必须为非负数字', data: null });
    }
    const sum = Math.round((cw + hw + ew) * 100) / 100;
    if (sum !== 100) {
      return res.json({ code: 400, message: `三项权重之和必须为 100，当前 ${sum}`, data: null });
    }
    const [weight] = await ScoreWeight.findOrCreate({ where: { course_id: id }, defaults: { course_id: id } });
    await weight.update({ checkin_weight: cw, homework_weight: hw, exam_weight: ew });
    res.json({ code: 0, message: '权重已更新（留痕见后续成绩模块）', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 教师将学生移出课堂
async function removeStudent(req, res) {
  try {
    const { id, studentId } = req.params;
    const course = await Course.findByPk(id);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (course.teacher_id !== req.user.id) {
      return res.json({ code: 403, message: '仅授课教师可移出学生', data: null });
    }
    const enrollment = await CourseStudent.findOne({ where: { course_id: id, student_id: studentId } });
    if (!enrollment) {
      return res.json({ code: 404, message: '该学生不在课堂中', data: null });
    }
    await enrollment.destroy();
    res.json({ code: 0, message: '已将该学生移出课堂', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 学生退出课堂
async function leaveCourse(req, res) {
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    const enrollment = await CourseStudent.findOne({ where: { course_id: id, student_id: req.user.id } });
    if (!enrollment) {
      return res.json({ code: 404, message: '你不在该课堂中', data: null });
    }
    await enrollment.destroy();
    res.json({ code: 0, message: '已退出课堂', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 删除/归档课堂（教师或管理员）
// 规则：课程已有教学数据（签到/作业/调查/考试/表情/成绩变更）时归档隐藏，保留数据；
//       空课程（无任何业务数据）则真删并级联清理选课关系与权重
async function deleteCourse(req, res) {
  try {
    const id = req.params.id;
    const course = await Course.findByPk(id);
    if (!course) return res.json({ code: 404, message: '课堂不存在', data: null });
    if (req.user.role === 'teacher' && course.teacher_id !== req.user.id) {
      return res.json({ code: 403, message: '仅授课教师可删除课堂', data: null });
    }
    if (course.status === 'archived') {
      return res.json({ code: 400, message: '该课堂已归档', data: null });
    }
    const [sessionCount, homeworkCount, surveyCount, examCount, emotionCount, scoreCount] = await Promise.all([
      ClassSession.count({ where: { course_id: id } }),
      Homework.count({ where: { course_id: id } }),
      Survey.count({ where: { course_id: id } }),
      Exam.count({ where: { course_id: id } }),
      EmotionRound.count({ include: [{ model: ClassSession, as: 'session', where: { course_id: id } }] }),
      ScoreChange.count({ where: { course_id: id } }),
    ]);
    const hasData = sessionCount + homeworkCount + surveyCount + examCount + emotionCount + scoreCount > 0;
    if (hasData) {
      await course.update({ status: 'archived' });
      return res.json({ code: 0, message: '该课堂已有教学数据，已归档隐藏（数据保留）', data: { archived: true } });
    }
    await CourseStudent.destroy({ where: { course_id: id } });
    await ScoreWeight.destroy({ where: { course_id: id } });
    await course.destroy();
    res.json({ code: 0, message: '课堂已删除', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

module.exports = { createCourse, listCourses, getCourse, updateCourse, joinCourse, getQrcode, refreshCode, updateWeights, removeStudent, leaveCourse, deleteCourse };
