// 课堂会话与定位签到路由
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const checkinController = require('../controllers/checkinController');

// —— 课堂会话（开始/结束上课）——
// 开始上课（教师；已有进行中会话则复用；兼容接口清单 POST /courses/:id/sessions）
router.post('/courses/:id/session', requireAuth, requireRole('teacher'), checkinController.startSession);
router.post('/courses/:id/sessions', requireAuth, requireRole('teacher'), checkinController.startSession);
// 结束上课（教师；兼容接口清单 PUT /sessions/:id/end）
router.post('/sessions/:id/end', requireAuth, requireRole('teacher'), checkinController.endSession);
router.put('/sessions/:id/end', requireAuth, requireRole('teacher'), checkinController.endSession);
// 会话列表（教师=全部 / 学生=可见）
router.get('/courses/:id/sessions', requireAuth, checkinController.listSessions);

// —— 签到活动 ——
// 教师发布定位签到（基准点=教师实时位置）
router.post('/sessions/:id/checkin', requireAuth, requireRole('teacher'), checkinController.publishCheckin);
// 学生定位签到（200m 判定 + 防代签）
router.post('/checkins/:id/sign', requireAuth, requireRole('student'), checkinController.signCheckin);
// 签到统计（教师）：应到/已签/缺勤 + 明细
router.get('/checkins/:id/stats', requireAuth, checkinController.checkinStats);
// 教师登记补签
router.post('/checkins/:id/makeup', requireAuth, requireRole('teacher'), checkinController.makeupCheckin);
// 教师登记请假
router.post('/checkins/:id/leave', requireAuth, requireRole('teacher'), checkinController.leaveCheckin);

// —— 学生端 ——
// 我的签到记录（跨课程最近 50 条）
router.get('/checkins/me', requireAuth, requireRole('student'), checkinController.myCheckins);

module.exports = router;
