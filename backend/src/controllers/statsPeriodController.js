// 统计周期配置控制器（管理员端）
// 管理端配置学情统计周期（按周/按月/自定义区间），学情报告按配置周期展示统计口径
const StatsPeriodConfig = require('../models/StatsPeriodConfig');

// 前端 camelCase -> 模型 snake_case 列名映射
const MAP = { name: 'name', periodType: 'period_type', startDate: 'start_date', endDate: 'end_date', semester: 'semester', enabled: 'enabled' };

function pick(body) {
  const d = {};
  Object.entries(MAP).forEach(([k, v]) => {
    if (body[k] !== undefined) d[v] = body[k];
  });
  return d;
}

// 管理员：配置列表
async function list(req, res) {
  try {
    const list = await StatsPeriodConfig.findAll({ order: [['created_at', 'DESC']] });
    res.json({ code: 0, message: 'ok', data: { list } });
  } catch (e) {
    res.json({ code: 500, message: '获取失败：' + e.message, data: null });
  }
}

// 管理员：新增配置
async function create(req, res) {
  try {
    const body = pick(req.body);
    if (!body.name || !body.period_type) {
      return res.json({ code: 400, message: '请填写配置名称与周期类型', data: null });
    }
    if (body.period_type === 'custom' && (!body.start_date || !body.end_date)) {
      return res.json({ code: 400, message: '自定义周期需填写起止日期', data: null });
    }
    const cfg = await StatsPeriodConfig.create(body);
    res.json({ code: 0, message: 'ok', data: { config: cfg } });
  } catch (e) {
    res.json({ code: 500, message: '创建失败：' + e.message, data: null });
  }
}

// 管理员：更新配置
async function update(req, res) {
  try {
    const cfg = await StatsPeriodConfig.findByPk(req.params.id);
    if (!cfg) return res.json({ code: 404, message: '配置不存在', data: null });
    const body = pick(req.body);
    if (body.period_type === 'custom' && (!body.start_date || !body.end_date)) {
      return res.json({ code: 400, message: '自定义周期需填写起止日期', data: null });
    }
    await cfg.update(body);
    res.json({ code: 0, message: 'ok', data: { config: cfg } });
  } catch (e) {
    res.json({ code: 500, message: '更新失败：' + e.message, data: null });
  }
}

// 管理员：删除配置
async function remove(req, res) {
  try {
    const cfg = await StatsPeriodConfig.findByPk(req.params.id);
    if (!cfg) return res.json({ code: 404, message: '配置不存在', data: null });
    await cfg.destroy();
    res.json({ code: 0, message: '已删除', data: null });
  } catch (e) {
    res.json({ code: 500, message: '删除失败：' + e.message, data: null });
  }
}

// 任意登录用户：当前生效的统计周期（优先学期匹配，其次全局；供学情报告页展示）
async function current(req, res) {
  try {
    const { semester } = req.query;
    const list = await StatsPeriodConfig.findAll({ where: { enabled: true }, order: [['created_at', 'DESC']] });
    const hit = semester ? (list.find((c) => c.semester === semester) || list.find((c) => !c.semester)) : list.find((c) => !c.semester);
    res.json({ code: 0, message: 'ok', data: { config: hit || null } });
  } catch (e) {
    res.json({ code: 500, message: '获取失败：' + e.message, data: null });
  }
}

module.exports = { list, create, update, remove, current };
