// 弹幕点赞模型（每人每弹幕一次，可取消）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DanmakuLike = sequelize.define('danmaku_likes', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  message_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'danmaku_likes',
  timestamps: false,
});

module.exports = DanmakuLike;
