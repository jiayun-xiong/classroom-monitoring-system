// 随堂作业路由
const express = require('express');
const router = express.Router();
const homeworkController = require('../controllers/homeworkController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 教师：发布作业
router.post('/courses/:courseId/homeworks', requireAuth, requireRole('teacher', 'admin'), homeworkController.createHomework);
// 教师/学生：作业列表
router.get('/courses/:courseId/homeworks', requireAuth, homeworkController.listHomeworks);
// 教师/学生：作业详情
router.get('/homeworks/:id', requireAuth, homeworkController.getHomework);
// 教师：修改作业
router.put('/homeworks/:id', requireAuth, requireRole('teacher', 'admin'), homeworkController.updateHomework);
// 教师：删除作业
router.delete('/homeworks/:id', requireAuth, requireRole('teacher', 'admin'), homeworkController.deleteHomework);
// 学生：提交/重交
router.post('/homeworks/:id/submit', requireAuth, requireRole('student'), homeworkController.submitHomework);
// 教师：批改
router.put('/homeworks/:id/grade', requireAuth, requireRole('teacher', 'admin'), homeworkController.gradeSubmission);
// 教师：打回重交
router.put('/homeworks/:id/return', requireAuth, requireRole('teacher', 'admin'), homeworkController.returnSubmission);
// 教师：豁免/取消豁免
router.put('/homeworks/:id/exempt', requireAuth, requireRole('teacher', 'admin'), homeworkController.exemptStudent);

module.exports = router;
