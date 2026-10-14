// 认证路由
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 管理员注册用户（老师/管理员/学生账号创建）
router.post('/register', requireAuth, requireRole('admin'), authController.register);
// 用户名密码登录
router.post('/login', authController.login);
// 短信验证码（mock）
router.post('/sms/send', authController.sendSmsCode);
router.post('/sms/login', authController.smsLogin);
// 第三方登录占位
router.post('/oauth/:provider', authController.oauthLogin);
// 当前用户信息
router.get('/me', requireAuth, authController.me);
// 登出
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
