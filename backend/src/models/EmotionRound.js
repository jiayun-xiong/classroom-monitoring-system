// 学情反馈轮次模型（教师按需开启：选择知识点 + 设置反馈时长）
// 对应系统设计 emotion_rounds 表（实现扩展：反馈由"固定窗口"升级为教师可开启/关闭的轮次）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ClassSession = require('./ClassSession');

const EmotionRound = sequelize.define('emotion_rounds', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  knowledge_point: {
    type: DataTypes.STRING(200),
    allowNull: false,
    defaultValue: '课堂反馈',
    comment: '本次需反馈的知识点',
  },
  duration_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    comment: '反馈时长（分钟）',
  },
  start_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  end_at: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '截止时间 = 开启时间 + 时长',
  },
  status: {
    type: DataTypes.ENUM('open', 'closed'),
    allowNull: false,
    defaultValue: 'open',
    comment: '反馈轮次状态（教师可手动关闭，或到期自动视为截止）',
  },
});

EmotionRound.belongsTo(ClassSession, { foreignKey: 'session_id', as: 'session' });
ClassSession.hasMany(EmotionRound, { foreignKey: 'session_id', as: 'emotionRounds' });

module.exports = EmotionRound;
