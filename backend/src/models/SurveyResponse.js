// 学情调查反馈记录模型（对应系统设计 survey_responses 表）
// 同一学生同一调查可多次反馈（修改），学生维度最新一条 = id 最大
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Survey = require('./Survey');
const User = require('./User');

const SurveyResponse = sequelize.define('survey_responses', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  survey_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '6 档理解评分 1-6（use_emotion=true 时使用）',
  },
  answer: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '自定义选项值（use_emotion=false 时使用）',
  },
});

// 关联
SurveyResponse.belongsTo(Survey, { foreignKey: 'survey_id', as: 'survey' });
Survey.hasMany(SurveyResponse, { foreignKey: 'survey_id', as: 'responses' });
SurveyResponse.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

module.exports = SurveyResponse;
