// 课堂项目路由
const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// 教师创建课堂
router.post('/', requireAuth, requireRole('teacher', 'admin'), courseController.createCourse);
// 课程列表（教师=我创建的 / 学生=我加入的 / 管理员=全部）
router.get('/', requireAuth, courseController.listCourses);
// 课程详情
router.get('/:id', requireAuth, courseController.getCourse);
// 教师更新课程
router.put('/:id', requireAuth, requireRole('teacher'), courseController.updateCourse);
// 学生加入课堂（便捷入口：仅凭课堂码加入；与 /:id/join 等价，二维码场景可携带 id）
router.post('/join', requireAuth, requireRole('student'), courseController.joinCourse);
// 学生加入课堂（接口清单定义路径，按课堂码校验）
router.post('/:id/join', requireAuth, requireRole('student'), courseController.joinCourse);
// 课堂二维码
router.get('/:id/qrcode', requireAuth, requireRole('teacher', 'admin'), courseController.getQrcode);
// 刷新课堂码
router.post('/:id/refresh-code', requireAuth, requireRole('admin'), courseController.refreshCode);
// 设置成绩权重
router.put('/:id/weights', requireAuth, requireRole('teacher'), courseController.updateWeights);
// 教师移出学生
router.delete('/:id/students/:studentId', requireAuth, requireRole('teacher'), courseController.removeStudent);
// 学生退出课堂
router.delete('/:id/me', requireAuth, requireRole('student'), courseController.leaveCourse);
// 删除/归档课堂（教师或管理员；有数据→归档，空课→真删）
router.delete('/:id', requireAuth, requireRole('teacher', 'admin'), courseController.deleteCourse);

module.exports = router;
