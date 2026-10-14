// 统计周期配置路由
const express = require('express');
const router = express.Router();
const statsPeriodController = require('../controllers/statsPeriodController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 任意登录用户：当前生效统计周期（学情报告展示用）
router.get('/stats-periods/current', requireAuth, statsPeriodController.current);

// 管理员：统计周期配置管理
router.get('/stats-periods', requireAuth, requireRole('admin'), statsPeriodController.list);
router.post('/stats-periods', requireAuth, requireRole('admin'), statsPeriodController.create);
router.put('/stats-periods/:id', requireAuth, requireRole('admin'), statsPeriodController.update);
router.delete('/stats-periods/:id', requireAuth, requireRole('admin'), statsPeriodController.remove);

module.exports = router;
