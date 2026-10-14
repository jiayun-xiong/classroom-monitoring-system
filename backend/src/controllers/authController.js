// 认证控制器：注册（管理员）/登录/当前用户/登出/短信mock/第三方占位
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const { signToken } = require('../utils/jwt');

// 管理员创建用户（对应 /auth/register 与 /users POST，此处先实现 register）
async function register(req, res) {
  try {
    const { username, password, name, role, phone, studentNo, grade, className, major } = req.body;
    if (!username || !password || !name || !role) {
      return res.json({ code: 400, message: '缺少必填字段', data: null });
    }
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.json({ code: 400, message: '角色不合法', data: null });
    }
    const exists = await User.findOne({ where: { username } });
    if (exists) {
      return res.json({ code: 400, message: '用户名已存在', data: null });
    }
    const password_hash = bcrypt.hashSync(password, 10);
    const user = await User.create({ username, password_hash, name, phone, role });
    // 学生角色补充扩展信息
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

// 登录（用户名 + 密码）
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.json({ code: 400, message: '请输入用户名和密码', data: null });
    }
    const user = await User.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.json({ code: 401, message: '用户名或密码错误', data: null });
    }
    const token = signToken({ id: user.id, username: user.username, role: user.role });
    res.json({
      code: 0,
      message: 'ok',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          phone: user.phone,
        },
      },
    });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 当前登录用户信息
async function me(req, res) {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'name', 'age', 'gender', 'phone', 'role'],
      include: req.user.role === 'student'
        ? [{ model: Student, as: 'student', attributes: ['student_no', 'grade', 'class_name', 'major'] }]
        : [],
    });
    res.json({ code: 0, message: 'ok', data: { user } });
  } catch (err) {
    res.json({ code: 500, message: '服务器错误: ' + err.message, data: null });
  }
}

// 登出（前端清除 token 即可，此处返回提示）
function logout(req, res) {
  res.json({ code: 0, message: '已退出登录', data: null });
}

// 短信验证码（开发阶段 mock：固定返回 123456）
async function sendSmsCode(req, res) {
  const { phone } = req.body;
  if (!phone) {
    return res.json({ code: 400, message: '请输入手机号', data: null });
  }
  res.json({ code: 0, message: '验证码已发送（开发模式）', data: { mockCode: '123456' } });
}

// 短信验证码登录（开发阶段 mock：验证码固定 123456）
async function smsLogin(req, res) {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.json({ code: 400, message: '请输入手机号和验证码', data: null });
  }
  if (code !== '123456') {
    return res.json({ code: 401, message: '验证码错误', data: null });
  }
  const user = await User.findOne({ where: { phone } });
  if (!user) {
    return res.json({ code: 404, message: '该手机号未注册', data: null });
  }
  const token = signToken({ id: user.id, username: user.username, role: user.role });
  res.json({
    code: 0,
    message: 'ok',
    data: {
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    },
  });
}

// 第三方登录（开发阶段占位：模拟成功）
async function oauthLogin(req, res) {
  const provider = req.params.provider;
  if (!['wechat', 'qq'].includes(provider)) {
    return res.json({ code: 400, message: '不支持的第三方平台', data: null });
  }
  res.json({ code: 0, message: '第三方登录为占位功能（开发模式）', data: { provider } });
}

module.exports = { register, login, me, logout, sendSmsCode, smsLogin, oauthLogin };
