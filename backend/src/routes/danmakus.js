// 讨论区与弹幕路由
const express = require('express');
const router = express.Router();
const danmakuController = require('../controllers/danmakuController');
const { requireAuth } = require('../middlewares/auth');

// 课堂状态（上课中会话/暂停/页码/匿名）
router.get('/courses/:courseId/danmaku/status', requireAuth, danmakuController.classroomStatus);
// 弹幕列表（多来源）
router.get('/courses/:courseId/danmaku', requireAuth, danmakuController.listDanmaku);
// 发送弹幕/讨论
router.post('/courses/:courseId/danmaku', requireAuth, danmakuController.sendDanmaku);
// 点赞/取消点赞
router.post('/danmaku/:id/like', requireAuth, danmakuController.toggleLike);
// 老师：暂停/恢复（全局）
router.post('/courses/:courseId/danmaku/pause', requireAuth, danmakuController.setPause);
// 老师：匿名开关
router.post('/courses/:courseId/danmaku/anonymous', requireAuth, danmakuController.setAnonymous);
// 老师：PPT 页码同步
router.post('/courses/:courseId/danmaku/page', requireAuth, danmakuController.setPage);

module.exports = router;
