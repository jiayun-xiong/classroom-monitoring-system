// 成绩管理路由
const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/scoreController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 学生：我的成绩明细（只读）
router.get('/courses/:courseId/scores/me', requireAuth, requireRole('student'), scoreController.getMyScores);
// 教师/管理员：班级成绩明细
router.get('/courses/:courseId/scores', requireAuth, requireRole('teacher', 'admin'), scoreController.getCourseScores);
// 教师/管理员：修改成绩（homework/exam，必填原因留痕）
router.put('/courses/:courseId/scores/:itemType', requireAuth, requireRole('teacher', 'admin'), scoreController.updateScore);
// 教师/管理员：变更留痕
router.get('/courses/:courseId/score-changes', requireAuth, requireRole('teacher', 'admin'), scoreController.getScoreChanges);

module.exports = router;
