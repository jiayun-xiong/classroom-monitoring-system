// 表情反馈模型（对应系统设计 emotion_feedbacks 表）
// 同一学生同一反馈轮次可多次提交（每次提交追加记录，统计时按最新一条聚合实时学情）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ClassSession = require('./ClassSession');
const User = require('./User');

const EmotionFeedback = sequelize.define('emotion_feedbacks', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  round_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '所属反馈轮次（升级后提交都挂轮次；旧数据为空）',
  },
  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  score: {
    type: DataTypes.TINYINT,
    allowNull: false,
    comment: '理解程度 1-6（6=完全理解，1=完全没理解）',
    validate: { min: 1, max: 6 },
  },
});

EmotionFeedback.belongsTo(ClassSession, { foreignKey: 'session_id', as: 'session' });
ClassSession.hasMany(EmotionFeedback, { foreignKey: 'session_id', as: 'feedbacks' });
EmotionFeedback.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
User.hasMany(EmotionFeedback, { foreignKey: 'student_id', as: 'emotionFeedbacks' });

module.exports = EmotionFeedback;
