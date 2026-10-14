// 通知已读明细模型（per-user 已读状态）
// 解决"发给全班的通知 is_read 全局共享"缺陷：每个用户一条已读记录
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationRead = sequelize.define('notification_reads', {
  notification_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'notification_reads',
  timestamps: false,
});

module.exports = NotificationRead;
