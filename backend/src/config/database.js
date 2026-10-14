// 数据库连接配置（Sequelize + MySQL）
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false, // 开发阶段可改为 console.log 查看 SQL
    define: {
      underscored: true, // 字段使用下划线命名（created_at）
      freezeTableName: true, // 表名不自动加复数
      timestamps: true,
    },
    pool: {
      max: 20, // 连接池，支撑 200 人并发
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = sequelize;
