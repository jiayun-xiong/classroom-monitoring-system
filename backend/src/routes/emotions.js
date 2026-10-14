// 表情反馈与学情统计路由（反馈轮次模式：教师开启-选知识点-设时长，学生提交，实时统计）
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const emotionController = require('../controllers/emotionController');

// ---- 教师：开启/关闭学情反馈轮次 ----
router.post('/sessions/:id/emotion/round', requireAuth, requireRole('teacher'), emotionController.openEmotionRound);
router.post('/rounds/:roundId/close', requireAuth, requireRole('teacher'), emotionController.closeEmotionRound);

// ---- 学生：查询当前开放反馈轮次 / 提交表情 ----
router.get('/sessions/:id/emotion/round/active', requireAuth, requireRole('student'), emotionController.activeRound);
router.post('/rounds/:roundId/emotion', requireAuth, requireRole('student'), emotionController.submitEmotionToRound);

// ---- 统计与快照（教师/管理员） ----
router.get('/rounds/:roundId/stats', requireAuth, emotionController.roundStats);
router.post('/rounds/:roundId/stats/snapshot', requireAuth, requireRole('teacher'), emotionController.snapshotRound);
router.get('/rounds/:roundId/stats/snapshots', requireAuth, emotionController.roundSnapshots);

// ---- 学生：我的表情历史 ----
router.get('/emotions/me', requireAuth, requireRole('student'), emotionController.myEmotions);

module.exports = router;
