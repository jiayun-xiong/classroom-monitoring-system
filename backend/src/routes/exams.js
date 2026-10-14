// 期末考试与总成绩路由
const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 教师：发布考试
router.post('/courses/:courseId/exams', requireAuth, requireRole('teacher', 'admin'), examController.createExam);
// 教师/学生：考试列表
router.get('/courses/:courseId/exams', requireAuth, examController.listExams);
// 教师：考试成绩名单
router.get('/exams/:id/scores', requireAuth, requireRole('teacher', 'admin'), examController.getExamScores);
// 教师：录入/确认成绩
router.put('/exams/:id/scores', requireAuth, requireRole('teacher', 'admin'), examController.saveScores);
// 学生：线上作答提交
router.post('/exams/:id/submit', requireAuth, requireRole('student'), examController.submitScore);
// 三端：加权总成绩与排名
router.get('/courses/:courseId/final', requireAuth, examController.finalScores);

module.exports = router;
