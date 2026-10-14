// 服务启动入口：连接数据库 → 启动 HTTP 服务
const dotenv = require('dotenv');

dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const { seedInitialUsers } = require('./seed/init');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    const dbName = process.env.DB_DIALECT === 'sqlite' ? 'SQLite 文件数据库' : 'MySQL';
    console.log(`[db] ${dbName} 连接成功`);

    // 同步模型（开发阶段用 alter 自动建表；上线前改为迁移脚本）
    // 模型接入后取消注释即可自动建表
    await sequelize.sync({ alter: true });
    console.log('[db] 表结构同步完成');

    // 初始化测试账号
    await seedInitialUsers();

    // 签到过期自动归档：启动即扫描一次，之后每 60 秒扫描
    const { expireCheckins } = require('./services/checkinExpireService');
    expireCheckins();
    setInterval(expireCheckins, 60 * 1000);

    app.listen(PORT, () => {
      console.log(`[server] 后端服务已启动: http://localhost:${PORT}`);
      console.log(`[server] 健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[db] 数据库连接失败:', err.message);
    if (process.env.DB_DIALECT === 'sqlite') {
      console.error('请确认 backend/data 目录可写，且已执行 npm install');
    } else {
      console.error('请确认 MySQL 已启动，且 .env 中的数据库配置正确');
    }
    process.exit(1);
  }
}

start();
