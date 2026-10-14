// 认证与权限中间件
const { verifyToken } = require('../utils/jwt');

// 登录校验：解析 Authorization: Bearer <token>，挂载 req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录', data: null });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录', data: null });
  }
  req.user = { id: payload.id, username: payload.username, role: payload.role };
  next();
}

// 角色校验：仅允许指定角色访问（可传多个角色）
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录', data: null });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '无权限访问', data: null });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
