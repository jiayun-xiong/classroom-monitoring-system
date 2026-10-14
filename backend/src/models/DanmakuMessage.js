// 弹幕/讨论消息模型（对应系统设计 danmaku_messages 表）
// 来源：live 实时 / checkin 签到 / emotion 表情反馈 / survey 学情调查 / homework 随堂作业
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DanmakuMessage = sequelize.define('danmaku_messages', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  session_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  source: {
    type: DataTypes.ENUM('live', 'checkin', 'emotion', 'survey', 'homework'),
    allowNull: false,
    defaultValue: 'live',
  },
  ref_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // 来源对象 id（如作业 id、调查 id），便于点击跳转
  },
  sender_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  sender_role: {
    type: DataTypes.ENUM('teacher', 'student', 'admin'),
    allowNull: false,
  },
  content: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  is_anonymous: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  likes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'danmaku_messages',
  timestamps: false,
});

module.exports = DanmakuMessage;
