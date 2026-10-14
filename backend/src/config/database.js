// 数据库连接配置（Sequelize）
// 默认 MySQL；设置环境变量 DB_DIALECT=sqlite 可切换为文件数据库，无需安装 MySQL
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const dialect = process.env.DB_DIALECT || 'mysql';

// 两种数据库共用的模型定义选项（请勿改动字段命名约定）
const defineOptions = {
  underscored: true, // 字段使用下划线命名（created_at）
  freezeTableName: true, // 表名不自动加复数
  timestamps: true,
};

let sequelize;

if (dialect === 'sqlite') {
  // 懒人模式：数据保存在本地文件，无需安装 MySQL
  const storagePath = process.env.DB_STORAGE
    || path.join(__dirname, '../../data/dev.sqlite');
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false,
    define: defineOptions,
  });
} else {
  // 完整模式：连接 MySQL 8
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: false, // 开发阶段可改为 console.log 查看 SQL
      define: defineOptions,
      pool: {
        max: 20, // 连接池，支撑 200 人并发
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
}

module.exports = sequelize;
