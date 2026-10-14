// 课程学情报告控制器
// 覆盖：课程结束后渲染学情报告——总体统计（班级规模/出勤/作业/调查/期末/总成绩分布/趋势）+
//      每个学生明细与排名（教师/管理员）、总体 + 自己各项排名（学生）
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
const CourseStudent = require('../models/CourseStudent');
const User = require('../models/User');

async function isTeacherOrAdmin(course, userId, role) {
  return role === 'admin' || Number(course.teacher_id) === Number(userId);
}

async function isEnrolled(courseId, studentId) {
  const c = await CourseStudent.findOne({ where: { course_id: courseId, student_id: studentId } });
  return !!c;
}

// ============ 基础计算：各项成绩 + 排名（与 finalScores 口径一致） ============
async function computeBase(courseId) {
  const course = await Course.findByPk(courseId);
  const [weight] = await ScoreWeight.findOrCreate({
    where: { course_id: courseId },
    defaults: { course_id: courseId },
  });
  const cw = Number(weight.checkin_weight);
  const hw = Number(weight.homework_weight);
  const ew = Number(weight.exam_weight);

  const courseWithStudents = await Course.findByPk(courseId, {
    include: [{ model: User, as: 'students', attributes: ['id', 'username', 'name'] }],
  });
  const students = courseWithStudents.students || [];

  // 1) 签到：出勤率（正常+补签）/会话数
  const sessions = await ClassSession.findAll({
    where: { course_id: courseId },
    order: [['id', 'ASC']],
    attributes: ['id', 'session_date'],
  });
  const sessionCount = sessions.length;
  const checkinActs = await Checkin.findAll({
    where: { session_id: sessions.map((s) => s.id) },
    attributes: ['id', 'session_id'],
  });
  const checkinBySession = {};
  checkinActs.forEach((c) => {
    (checkinBySession[c.session_id] = checkinBySession[c.session_id] || []).push(c.id);
  });
  const checkinIds = checkinActs.map((c) => c.id);
  let records = [];
  if (checkinIds.length) {
    records = await CheckinRecord.findAll({
      where: { checkin_id: checkinIds },
      attributes: ['checkin_id', 'student_id', 'type'],
    });
  }
  const presentCountByStu = {};
  const presentSetByCheckin = {};
  records.forEach((r) => {
    if (r.type === 'normal' || r.type === 'makeup' || r.type === 'late') { // 迟到计入到课
      presentCountByStu[r.student_id] = (presentCountByStu[r.student_id] || 0) + 1;
      (presentSetByCheckin[r.checkin_id] = presentSetByCheckin[r.checkin_id] || new Set()).add(Number(r.student_id));
    }
  });
  const checkinTrend = sessions.map((s) => {
    const stSet = new Set();
    (checkinBySession[s.id] || []).forEach((cid) => {
      (presentSetByCheckin[cid] || new Set()).forEach((x) => stSet.add(x));
    });
    return {
      sessionId: s.id,
      date: s.session_date,
      present: stSet.size,
      total: students.length,
      rate: students.length ? Math.round((stSet.size / students.length) * 1000) / 10 : 0,
    };
  });

  // 2) 作业：非豁免平均（未交/未批改计 0；豁免不计入分母）
  const homeworks = await Homework.findAll({
    where: { course_id: courseId },
    order: [['created_at', 'ASC']],
    attributes: ['id', 'title'],
  });
  const hwIds = homeworks.map((h) => h.id);
  const exempts = await HomeworkExempt.findAll({
    where: { homework_id: hwIds },
    attributes: ['homework_id', 'student_id'],
  });
  const exemptSet = new Set(exempts.map((e) => `${e.homework_id}-${e.student_id}`));
  const nonExemptCount = hwIds.length;
  const subs = await HomeworkSubmission.findAll({
    where: { homework_id: hwIds },
    attributes: ['homework_id', 'student_id', 'score', 'status'],
  });
  const scoreByStudent = {};
  const perHwScore = {};
  subs.forEach((s) => {
    const key = `${s.homework_id}-${s.student_id}`;
    if (s.status === 'graded' && s.score != null && !exemptSet.has(key)) {
      scoreByStudent[s.student_id] = (scoreByStudent[s.student_id] || 0) + Number(s.score);
      const a = (perHwScore[s.homework_id] = perHwScore[s.homework_id] || { sum: 0, count: 0 });
      a.sum += Number(s.score);
      a.count += 1;
    }
  });
  const homeworkStats = homeworks.map((h) => ({
    id: h.id,
    name: h.title,
    avg: perHwScore[h.id] ? Math.round((perHwScore[h.id].sum / perHwScore[h.id].count) * 10) / 10 : 0,
    gradedCount: perHwScore[h.id] ? perHwScore[h.id].count : 0,
  }));

  // 3) 期末：最新一条按满分折算百分制
  const exams = await Exam.findAll({
    where: { course_id: courseId },
    order: [['exam_time', 'ASC']],
    attributes: ['id', 'name', 'full_score'],
  });
  const examScores = await ExamScore.findAll({
    where: { exam_id: exams.map((e) => e.id) },
    attributes: ['exam_id', 'student_id', 'score'],
    order: [['id', 'ASC']],
  });
  const examScoreByStudent = {};
  const scoreByExam = {};
  examScores.forEach((s) => {
    examScoreByStudent[s.student_id] = s;
    const a = (scoreByExam[s.exam_id] = scoreByExam[s.exam_id] || { sum: 0, count: 0 });
    a.sum += Number(s.score);
    a.count += 1;
  });
  const fullByExam = {};
  exams.forEach((e) => {
    fullByExam[e.id] = Number(e.full_score);
  });
  const examStats = exams.map((e) => ({
    id: e.id,
    name: e.name,
    fullScore: fullByExam[e.id],
    avg: scoreByExam[e.id] ? Math.round((scoreByExam[e.id].sum / scoreByExam[e.id].count) * 10) / 10 : 0,
    scoredCount: scoreByExam[e.id] ? scoreByExam[e.id].count : 0,
  }));

  // 4) 调查：参与调查数（去重）
  const surveys = await Survey.findAll({ where: { course_id: courseId }, attributes: ['id'] });
  const surveyResp = await SurveyResponse.findAll({
    where: { survey_id: surveys.map((s) => s.id) },
    attributes: ['survey_id', 'student_id'],
  });
  const surveySetByStu = {};
  surveyResp.forEach((s) => {
    (surveySetByStu[s.student_id] = surveySetByStu[s.student_id] || new Set()).add(Number(s.survey_id));
  });

  // 5) 学生行 + 加权总成绩
  const rows = students.map((st) => {
    const sid = Number(st.id);
    const checkinScore =
      sessionCount === 0 ? 100 : Math.round(((presentCountByStu[sid] || 0) / sessionCount) * 100 * 10) / 10;
    const homeworkScore =
      nonExemptCount === 0 ? 100 : Math.round(((scoreByStudent[sid] || 0) / nonExemptCount) * 10) / 10;
    let examScore = null;
    const es = examScoreByStudent[sid];
    if (es) {
      const full = fullByExam[es.exam_id] || 100;
      examScore = Math.round((Number(es.score) / full) * 100 * 10) / 10;
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
      surveyCount: surveySetByStu[sid] ? surveySetByStu[sid].size : 0,
      surveyTotal: surveys.length,
    };
  });

  // 6) 排名（分数降序、并列同名次）
  function rankBy(list, key) {
    const sorted = [...list]
      .filter((r) => r[key] != null)
      .sort((a, b) => b[key] - a[key]);
    let last = null;
    let cur = 0;
    sorted.forEach((r) => {
      if (r[key] !== last) {
        cur += 1;
        last = r[key];
      }
      r[key + 'Rank'] = cur;
    });
    list.forEach((r) => {
      if (r[key] == null) r[key + 'Rank'] = null;
    });
    return sorted.length;
  }
  rankBy(rows, 'final');
  rankBy(rows, 'checkinScore');
  rankBy(rows, 'homeworkScore');
  rankBy(rows, 'examScore');
  rankBy(rows, 'surveyCount');

  return {
    course,
    students,
    rows,
    weights: { checkinWeight: cw, homeworkWeight: hw, examWeight: ew },
    sessionCount,
    checkinTrend,
    homeworkStats,
    examStats,
    examCount: exams.length,
    surveyTotal: surveys.length,
  };
}

function buildOverall(base) {
  const { rows, students, checkinTrend, homeworkStats, examStats } = base;
  const n = students.length;
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
  const graded = rows.filter((r) => r.final != null);
  const dist = [
    { range: '90-100', count: 0 },
    { range: '80-89', count: 0 },
    { range: '70-79', count: 0 },
    { range: '60-69', count: 0 },
    { range: '0-59', count: 0 },
  ];
  graded.forEach((r) => {
    const f = Number(r.final);
    if (f >= 90) dist[0].count += 1;
    else if (f >= 80) dist[1].count += 1;
    else if (f >= 70) dist[2].count += 1;
    else if (f >= 60) dist[3].count += 1;
    else dist[4].count += 1;
  });
  const surveyTotal = n * base.surveyTotal;
  return {
    studentCount: n,
    sessionCount: base.sessionCount,
    homeworkCount: homeworkStats.length,
    examCount: base.examCount,
    surveyTotal: base.surveyTotal,
    avgCheckinScore: avg(rows.map((r) => r.checkinScore)),
    avgHomeworkScore: avg(rows.map((r) => r.homeworkScore)),
    avgExamScore: graded && rows.filter((r) => r.examScore != null).length ? avg(rows.filter((r) => r.examScore != null).map((r) => r.examScore)) : null,
    avgFinal: graded.length ? avg(graded.map((r) => r.final)) : null,
    surveyParticipationRate: surveyTotal
      ? Math.round((rows.reduce((a, r) => a + r.surveyCount, 0) / surveyTotal) * 1000) / 10
      : 0,
    gradeDist: dist,
    checkinTrend,
    homeworkStats,
    examStats,
  };
}

// ============ 教师/管理员：课程学情报告（总体 + 每个学生） ============
async function getReport(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (!(await isTeacherOrAdmin(course, req.user.id, req.user.role))) {
      return res.json({ code: 403, message: '仅授课教师/管理员可查看', data: null });
    }
    const base = await computeBase(course.id);
    const overall = buildOverall(base);
    const studentsList = base.rows.map((r) => ({
      student_id: r.student_id,
      name: r.name,
      username: r.username,
      checkinScore: r.checkinScore,
      homeworkScore: r.homeworkScore,
      examScore: r.examScore,
      final: r.final,
      surveyCount: r.surveyCount,
      surveyTotal: r.surveyTotal,
      finalRank: r.finalRank,
      checkinRank: r.checkinScoreRank,
      homeworkRank: r.homeworkScoreRank,
      examRank: r.examScoreRank,
      surveyRank: r.surveyCountRank,
    }));
    return res.json({
      code: 0,
      message: 'ok',
      data: { course: { id: course.id, name: course.name, credit: Number(course.credit) }, overall, students: studentsList, weights: base.weights },
    });
  } catch (e) {
    return res.json({ code: 500, message: '报告生成失败：' + e.message, data: null });
  }
}

// ============ 学生：课程学情报告（总体 + 自己 + 各项排名） ============
async function getMyReport(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    if (req.user.role !== 'student' || !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '仅本课程学生可查看', data: null });
    }
    const base = await computeBase(course.id);
    const overall = buildOverall(base);
    const me = base.rows.find((r) => Number(r.student_id) === Number(req.user.id)) || null;
    const meView = me
      ? {
          checkinScore: me.checkinScore,
          homeworkScore: me.homeworkScore,
          examScore: me.examScore,
          final: me.final,
          surveyCount: me.surveyCount,
          surveyTotal: me.surveyTotal,
          checkinRank: me.checkinScoreRank,
          homeworkRank: me.homeworkScoreRank,
          examRank: me.examScoreRank,
          finalRank: me.finalRank,
          surveyRank: me.surveyCountRank,
          totalStudents: base.students.length,
        }
      : null;
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        course: { id: course.id, name: course.name, credit: Number(course.credit) },
        overall,
        me: meView,
        weights: base.weights,
      },
    });
  } catch (e) {
    return res.json({ code: 500, message: '报告生成失败：' + e.message, data: null });
  }
}

// ============ 导出学情报告 Excel（课程信息 + 统计汇总 + 学生明细） ============
async function exportReport(req, res) {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) return res.json({ code: 404, message: '课程不存在', data: null });
    const isT = await isTeacherOrAdmin(course, req.user.id, req.user.role);
    if (!isT && !(await isEnrolled(course.id, req.user.id))) {
      return res.json({ code: 403, message: '仅授课教师/管理员/本课程学生可导出', data: null });
    }
    const base = await computeBase(course.id);
    const overall = buildOverall(base);
    const studentsList = base.rows.map((r) => ({
      学号: r.username,
      姓名: r.name,
      签到分: r.checkinScore,
      签到排名: r.checkinScoreRank,
      作业分: r.homeworkScore,
      作业排名: r.homeworkScoreRank,
      调查次数: r.surveyCount + '/' + r.surveyTotal,
      调查排名: r.surveyCountRank,
      期末分: r.examScore == null ? '待上传' : r.examScore,
      期末排名: r.examScoreRank == null ? '-' : r.examScoreRank,
      总成绩: r.final == null ? '待上传' : r.final,
      总排名: r.finalRank == null ? '-' : r.finalRank,
    }));
    const exportRows = isT ? studentsList : studentsList.filter((x) => x.学号 === req.user.username);

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = '课堂学情监控管理系统';

    // Sheet1 课程信息
    const ws1 = wb.addWorksheet('课程信息');
    const infoRows = [
      ['课程名称', course.name],
      ['学分', Number(course.credit)],
      ['学年学期', course.semester || '-'],
      ['周次', course.weeks || '-'],
      ['上课时间', course.schedule_time || '-'],
      ['上课地点', course.location || '-'],
      ['成绩权重(签到/作业/期末)', `${base.weights.checkinWeight}% / ${base.weights.homeworkWeight}% / ${base.weights.examWeight}%`],
    ];
    infoRows.forEach((r) => ws1.addRow(r));
    ws1.getRow(1).font = { bold: true, size: 14 };
    ws1.getColumn(1).width = 18; ws1.getColumn(2).width = 30;

    // Sheet2 统计汇总
    const ws2 = wb.addWorksheet('学情统计');
    const sumRows = [
      ['班级人数', overall.studentCount],
      ['平均出勤分', overall.avgCheckinScore],
      ['作业均分', overall.avgHomeworkScore],
      ['调查参与率', overall.surveyParticipationRate + '%'],
      ['期末均分', overall.avgExamScore == null ? '-' : overall.avgExamScore],
      ['总成绩均分', overall.avgFinal == null ? '-' : overall.avgFinal],
      ['', ''],
      ['总成绩分布', '人数'],
      ...(overall.dist || []).map((d) => [d.range, d.count]),
    ];
    sumRows.forEach((r) => ws2.addRow(r));
    ws2.getRow(1).font = { bold: true };
    ws2.getColumn(1).width = 18; ws2.getColumn(2).width = 16;

    // Sheet3 学生明细
    const ws3 = wb.addWorksheet('学生明细');
    const headers = ['学号', '姓名', '签到分', '签到排名', '作业分', '作业排名', '调查次数', '调查排名', '期末分', '期末排名', '总成绩', '总排名'];
    ws3.addRow(headers);
    ws3.getRow(1).font = { bold: true };
    ws3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    exportRows.forEach((r) => ws3.addRow(headers.map((h) => r[h])));
    ws3.columns.forEach((c, i) => { c.width = headers[i].length * 2 + 6; });

    const buf = await wb.xlsx.writeBuffer();
    const filename = encodeURIComponent(`${course.name}-学情报告-${course.semester || '历史'}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    return res.send(Buffer.from(buf));
  } catch (e) {
    return res.json({ code: 500, message: '导出失败：' + e.message, data: null });
  }
}

module.exports = { getReport, getMyReport, exportReport };
