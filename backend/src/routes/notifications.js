// 通知中心路由
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/auth');

// 三端：收件箱 / 未读数 / 发送 / 已读 / 全部已读
router.get('/notifications', requireAuth, notificationController.listNotifications);
router.get('/notifications/unread-count', requireAuth, notificationController.unreadCount)
router.get('/notifications/unread-by-type', requireAuth, notificationController.unreadByType);;
router.post('/notifications/send', requireAuth, notificationController.sendNotification);
router.post('/notifications/read-by-type', requireAuth, notificationController.readByType);
router.post('/notifications/:id/read', requireAuth, notificationController.markRead);
router.post('/notifications/read-all', requireAuth, notificationController.markAllRead);

module.exports = router;
