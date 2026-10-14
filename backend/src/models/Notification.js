// 通知中心模型（对应系统设计 notifications 表）
// 三端（教师/学生/管理员）相互通知：业务自动触发 + 手动发送；receiver_id 为 NULL 表示发给某角色全体
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('notifications', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  sender_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // 系统自动触发时为空
  },
  sender_role: {
    type: DataTypes.ENUM('teacher', 'student', 'admin', 'system'),
    allowNull: false,
  },
  receiver_id: {
    type: DataTypes.BIGINT,
    allowNull: true, // NULL = 该角色全体
  },
  receiver_role: {
    type: DataTypes.ENUM('teacher', 'student', 'admin'),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('message', 'homework', 'survey', 'exam', 'score', 'checkin', 'emotion'),
    allowNull: false,
    defaultValue: 'message',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  link: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  is_read: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'notifications',
  timestamps: false,
});

const NotificationRead = require('./NotificationRead');
Notification.hasMany(NotificationRead, { foreignKey: 'notification_id', as: 'reads' });

module.exports = Notification;
