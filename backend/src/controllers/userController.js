// 用户管理控制器：列表/创建/更新/删除/详情（仅管理员 + 本人查看）
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const Student = require('../models/Student');

// 用户列表（角色筛选 + 关键词 + 分页）
async function listUsers(req, res) {
  try {
    const { role, keyword, page = 1, size = 10 } = req.query;
    const where = {};
    if (role && ['student', 'teacher', 'admin'].includes(role)) {
      where.role = role;
    }
    if (keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${keyword}%` } },
        { name: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
      ];
    }
    const p = Math.max(1, parseInt(page, 10) || 1);
    const s = Math.min(100, Math.max(1, parseInt(size, 10) || 10));
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'username', 'name', 'age', 'gender', 'phone', 'role', 'created_at'],
      include: [{ model: Student, as: 'student', attributes: ['student_no', 'grade', 'class_name', 'major'] }],
      order: [['id', 'ASC']],
      limit: s,
      offset: (p - 1) * s,
    });
    res.json({ code: 0, message: 'ok', data: { list: rows, total: count } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 创建用户（学生可带扩展信息）
async function createUser(req, res) {
  try {
    const { username, password, name, role, phone, age, gender, studentNo, grade, className, major } = req.body;
    if (!username || !password || !name || !role) {
      return res.json({ code: 400, message: '缺少必填字段（用户名/密码/姓名/角色）', data: null });
    }
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.json({ code: 400, message: '角色不合法', data: null });
    }
    const exists = await User.findOne({ where: { username } });
    if (exists) {
      return res.json({ code: 400, message: '用户名已存在', data: null });
    }
    const password_hash = bcrypt.hashSync(password, 10);
    const user = await User.create({ username, password_hash, name, phone, age, gender, role });
    if (role === 'student') {
      await Student.create({
        user_id: user.id,
        student_no: studentNo || `S${String(user.id).padStart(6, '0')}`,
        grade: grade || null,
        class_name: className || null,
        major: major || null,
      });
    }
    res.json({ code: 0, message: '创建成功', data: { id: user.id } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 更新用户（含学生扩展；password 传入则重置密码）
async function updateUser(req, res) {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id);
    if (!user) {
      return res.json({ code: 404, message: '用户不存在', data: null });
    }
    const { name, phone, age, gender, password, studentNo, grade, className, major } = req.body;
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (phone !== undefined) patch.phone = phone;
    if (age !== undefined) patch.age = age;
    if (gender !== undefined) patch.gender = gender;
    if (password) patch.password_hash = bcrypt.hashSync(password, 10);
    await user.update(patch);

    // 学生扩展信息
    if (user.role === 'student') {
      const sp = {};
      if (studentNo !== undefined) sp.student_no = studentNo;
      if (grade !== undefined) sp.grade = grade;
      if (className !== undefined) sp.class_name = className;
      if (major !== undefined) sp.major = major;
      if (Object.keys(sp).length > 0) {
        const [student] = await Student.findOrCreate({ where: { user_id: id }, defaults: { user_id: id } });
        await student.update(sp);
      }
    }
    res.json({ code: 0, message: '更新成功', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 删除用户
async function deleteUser(req, res) {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id);
    if (!user) {
      return res.json({ code: 404, message: '用户不存在', data: null });
    }
    if (user.role === 'admin' && user.username === 'admin') {
      return res.json({ code: 400, message: '不允许删除内置管理员账号', data: null });
    }
    await Student.destroy({ where: { user_id: id } });
    await user.destroy();
    res.json({ code: 0, message: '删除成功', data: null });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 用户详情（管理员或本人）
async function getUser(req, res) {
  try {
    const id = req.params.id;
    if (req.user.role !== 'admin' && String(req.user.id) !== String(id)) {
      return res.json({ code: 403, message: '无权限查看他人信息', data: null });
    }
    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'name', 'age', 'gender', 'phone', 'role', 'created_at'],
      include: [{ model: Student, as: 'student', attributes: ['student_no', 'grade', 'class_name', 'major'] }],
    });
    if (!user) {
      return res.json({ code: 404, message: '用户不存在', data: null });
    }
    res.json({ code: 0, message: 'ok', data: { user } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

module.exports = { listUsers, createUser, updateUser, deleteUser, getUser };
