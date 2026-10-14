// ============================================================
// 文件作用：后端服务的启动入口
// 启动顺序：读配置 → 连数据库 → 建表 → 写测试账号 → 开始监听 HTTP 请求
// 运行命令：node src/server.js  或  npm run dev
// ============================================================

// 导入 dotenv 库，用来读取 .env 配置文件
const dotenv = require('dotenv');

// 执行读取动作：把 .env 里的键值对加载进 process.env
dotenv.config();

// 导入 Express 应用实例（app.js 里创建好并挂好了所有路由）
const app = require('./app');

// 导入数据库连接对象（database.js 根据 .env 自动选 MySQL 或 SQLite）
const sequelize = require('./config/database');

// 导入种子数据函数：首次启动时自动创建 admin/teacher/student 三个测试账号
const { seedInitialUsers } = require('./seed/init');

// 服务端口：从 .env 的 PORT 读，没配就默认 3000；Number() 把字符串转成数字
const PORT = Number(process.env.PORT) || 3000;

// 启动主流程，用 async 是因为里面有很多 await（等数据库操作完成）
async function start() {
  // try-catch 包住：任何一步失败都会进到 catch，打印错误并退出，而不是默默崩溃
  try {
    // 真正发一个测试查询到数据库，确认连接是通的；连不上会抛错
    await sequelize.authenticate();

    // 根据当前用的数据库类型，拼一句友好的提示文字
    const dbName = process.env.DB_DIALECT === 'sqlite' ? 'SQLite 文件数据库' : 'MySQL';
    // 在终端打印连接成功
    console.log(`[db] ${dbName} 连接成功`);

    // 把代码里定义的所有 model 自动建成数据库表；
    // alter: true 表示如果表已存在，就按 model 定义同步调整字段（开发阶段方便，正式上线应改用迁移脚本）
    await sequelize.sync({ alter: true });
    console.log('[db] 表结构同步完成');

    // 如果 users 表是空的，就写入三个测试账号（已有数据则跳过）
    await seedInitialUsers();

    // 导入"把过期签到自动标记为缺勤"的定时服务
    const { expireCheckins } = require('./services/checkinExpireService');
    // 启动时立刻先跑一次（防止重启前有过期签到没处理）
    expireCheckins();
    // 之后每 60 秒跑一次（60 * 1000 = 60000 毫秒 = 1 分钟）
    setInterval(expireCheckins, 60 * 1000);

    // 让 Express 开始监听端口，真正接收浏览器请求；第二个参数是启动成功后的回调
    app.listen(PORT, () => {
      console.log(`[server] 后端服务已启动: http://localhost:${PORT}`);
      console.log(`[server] 健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    // 任何一步出错：在终端打印错误原因
    console.error('[db] 数据库连接失败:', err.message);
    // 根据用的是哪种数据库，给不同的排查提示
    if (process.env.DB_DIALECT === 'sqlite') {
      console.error('请确认 backend/data 目录可写，且已执行 npm install');
    } else {
      console.error('请确认 MySQL 已启动，且 .env 中的数据库配置正确');
    }
    // 退出整个程序（退出码 1 表示异常退出）
    process.exit(1);
  }
}

// 最后这一行：真正执行上面定义的 start 函数，服务才会跑起来
start();
