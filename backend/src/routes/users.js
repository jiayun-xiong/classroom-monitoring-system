// 用户管理路由
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 列表/创建/更新/删除：仅管理员
router.get('/', requireAuth, requireRole('admin'), userController.listUsers);
router.post('/', requireAuth, requireRole('admin'), userController.createUser);
router.put('/:id', requireAuth, requireRole('admin'), userController.updateUser);
router.delete('/:id', requireAuth, requireRole('admin'), userController.deleteUser);
// 详情：管理员或本人
router.get('/:id', requireAuth, userController.getUser);

module.exports = router;
