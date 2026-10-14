// 学情调查路由
const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 教师：发起调查
router.post('/courses/:courseId/surveys', requireAuth, requireRole('teacher', 'admin'), surveyController.createSurvey);
// 教师/学生：调查列表
router.get('/courses/:courseId/surveys', requireAuth, surveyController.listSurveys);
// 教师/学生：调查详情
router.get('/surveys/:id', requireAuth, surveyController.getSurvey);
// 学生：反馈
router.post('/surveys/:id/respond', requireAuth, requireRole('student'), surveyController.respondSurvey);
// 教师：实时统计
router.get('/surveys/:id/stats', requireAuth, requireRole('teacher', 'admin'), surveyController.surveyStats);
// 教师：关闭
router.put('/surveys/:id/close', requireAuth, requireRole('teacher', 'admin'), surveyController.closeSurvey);
// 教师：删除
router.delete('/surveys/:id', requireAuth, requireRole('teacher', 'admin'), surveyController.deleteSurvey);

module.exports = router;
