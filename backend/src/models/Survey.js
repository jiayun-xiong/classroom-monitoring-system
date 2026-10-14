// 学情调查模型（对应系统设计 surveys 表）
// 教师每讲完一个知识点可发起调查；反馈形式：6 档理解评分 或 教师自定义选项
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Course = require('./Course');
const User = require('./User');

const Survey = sequelize.define('surveys', {
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
    comment: '关联课堂会话（可空）',
  },
  knowledge_point: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '调查关联的知识点',
  },
  use_emotion: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'true=6 档理解评分；false=自定义选项',
  },
  options: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '自定义选项（JSON 数组，use_emotion=false 时使用）',
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '截止时间（可空=持续开放，手动关闭）',
  },
  status: {
    type: DataTypes.ENUM('open', 'closed'),
    allowNull: false,
    defaultValue: 'open',
    comment: 'open=收集中 / closed=已关闭',
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '发起教师',
  },
});

// 关联
Survey.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Survey.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = Survey;
