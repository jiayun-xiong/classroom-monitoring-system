// 课程学情报告路由
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 教师/管理员：课程学情报告（总体 + 每个学生 + 排名）
router.get('/courses/:courseId/report', requireAuth, requireRole('teacher', 'admin'), reportController.getReport);

// 学生：课程学情报告（总体 + 自己 + 各项排名）
router.get('/courses/:courseId/report/me', requireAuth, requireRole('student'), reportController.getMyReport);

// 导出学情报告 Excel（教师/管理员全量明细，学生仅本人）
router.get('/courses/:courseId/report/export', requireAuth, reportController.exportReport);

module.exports = router;
