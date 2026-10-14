// ============================================================
// 文件作用：创建数据库连接对象（Sequelize 实例）
// 这个文件被 server.js 和所有 model 文件引用，是整个后端连数据库的入口
// ============================================================

// 从 sequelize 库导入 Sequelize 类，它是连接数据库的核心类
const { Sequelize } = require('sequelize');

// 导入 dotenv 库，作用是读取项目根目录下的 .env 文件，把里面的配置项变成 process.env.xxx
const dotenv = require('dotenv');

// 导入 Node.js 内置的 path 模块，用来拼接跨操作系统兼容的文件路径（Windows 用 \，Mac 用 /，path 自动处理）
const path = require('path');

// 导入 Node.js 内置的 fs 模块，用来操作文件和目录（这里用来自动建目录）
const fs = require('fs');

// 真正执行读取 .env 文件的动作，执行后 process.env 里就有 .env 的内容了
dotenv.config();

// 读取环境变量 DB_DIALECT；如果没配，默认走 mysql（作业要求）
// 这个值决定我们用哪种数据库：'sqlite' = 文件数据库（懒人模式），其他 = MySQL
const dialect = process.env.DB_DIALECT || 'mysql';

// 两种数据库共用的"模型定义选项"，决定所有数据表的字段命名规则
// 把它抽成一个常量，是为了两种模式保持一致，不出现"换了数据库字段命名规则也变了"的问题
const defineOptions = {
  underscored: true,   // 数据库字段名用下划线命名，比如 created_at（而不是 createdAt）
  freezeTableName: true, // 告诉 Sequelize 不要自动给表名加复数后缀（比如 User 表就叫 user，不要变成 users）
  timestamps: true,     // 自动给每条记录加上 created_at 和 updated_at 两个时间字段
};

// 声明一个变量，待会根据数据库模式把它赋值成不同的 Sequelize 实例
let sequelize;

// ============ 分支一：懒人模式（SQLite 文件数据库）============
// 当 .env 里写了 DB_DIALECT=sqlite 时走这里
if (dialect === 'sqlite') {
  // 数据库文件存在哪：优先读环境变量 DB_STORAGE；没配就默认放在 backend/data/dev.sqlite
  // __dirname 是当前文件（database.js）所在的目录，'../../data/dev.sqlite' 就是往上两级再进 data 目录
  const storagePath = process.env.DB_STORAGE
    || path.join(__dirname, '../../data/dev.sqlite');

  // 自动创建 data 目录（如果不存在的话）。recursive: true 表示路径中间缺几级目录也一起建
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });

  // 创建一个连 SQLite 的 Sequelize 实例
  sequelize = new Sequelize({
    dialect: 'sqlite',          // 告诉 Sequelize 我们用 SQLite 方言
    storage: storagePath,        // SQLite 不需要 host/port/账号密码，只要指定数据库文件路径
    logging: false,              // 关闭 SQL 日志打印（开 true 的话每条 SQL 都会打印在终端，调试时用）
    define: defineOptions,       // 套用上面统一的字段命名规则
  });
} else {
  // ============ 分支二：完整模式（MySQL 8）============
  // 从环境变量里读数据库连接信息，对应 .env 文件里的配置项
  sequelize = new Sequelize(
    process.env.DB_NAME,     // 数据库名
    process.env.DB_USER,     // 数据库用户名
    process.env.DB_PASSWORD, // 数据库密码
    {
      host: process.env.DB_HOST,           // 数据库地址，本机就是 127.0.0.1
      port: Number(process.env.DB_PORT) || 3306, // 端口，没配就用 MySQL 默认的 3306
      dialect: 'mysql',                    // 指定用 MySQL 方言
      logging: false,                       // 关闭 SQL 日志
      define: defineOptions,                // 套用统一的字段命名规则
      pool: {                               // 连接池配置：预先保持若干个数据库连接，避免每次请求都重新握手
        max: 20,           // 最多同时开 20 个连接（应对多用户并发）
        min: 0,            // 空闲时最少保持 0 个连接
        acquire: 30000,    // 拿一个连接最多等 30 毫秒，超时就报错
        idle: 10000,       // 连接空闲超过 100 毫秒就释放
      },
    }
  );
}

// 把创建好的 sequelize 实例导出，其他文件 require 本文件就能直接用同一个数据库连接
module.exports = sequelize;
