// 随堂作业模型（对应系统设计 homeworks 表）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Course = require('./Course');
const User = require('./User');

const Homework = sequelize.define('homeworks', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '提交截止时间',
  },
  format_rules: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '提交格式要求（JSON：文本/图片/附件，允许类型与大小）',
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '发布教师',
  },
});

// 关联
Homework.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Homework.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = Homework;
