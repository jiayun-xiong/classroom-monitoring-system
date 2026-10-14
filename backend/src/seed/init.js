// 种子数据：初始化三个角色的测试账号（仅当 users 表为空时执行）
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');

async function seedInitialUsers() {
  const count = await User.count();
  if (count > 0) {
    console.log('[seed] users 表已有数据，跳过初始化');
    return;
  }
  const admin = await User.create({
    username: 'admin',
    password_hash: bcrypt.hashSync('admin123', 10),
    name: '系统管理员',
    role: 'admin',
  });
  const teacher = await User.create({
    username: 'teacher1',
    password_hash: bcrypt.hashSync('123456', 10),
    name: '测试教师',
    role: 'teacher',
  });
  const student = await User.create({
    username: 'student1',
    password_hash: bcrypt.hashSync('123456', 10),
    name: '测试学生',
    role: 'student',
    phone: '13800000001',
  });
  await Student.create({
    user_id: student.id,
    student_no: '20260001',
    grade: '2026级',
    class_name: '软件工程1班',
    major: '软件工程',
  });
  console.log('[seed] 测试账号已创建：admin/admin123、teacher1/123456、student1/123456');
}

module.exports = { seedInitialUsers };
