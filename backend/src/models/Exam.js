// 期末考试模型（对应系统设计 exams 表）
// 学期末教师发布：考试名称、考试时间、满分、考试形式（线上作答 / 线下成绩录入）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Course = require('./Course');
const User = require('./User');

const Exam = sequelize.define('exams', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  exam_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '考试时间',
  },
  full_score: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: false,
    defaultValue: 100,
    comment: '满分',
  },
  form: {
    type: DataTypes.ENUM('online', 'offline'),
    allowNull: false,
    defaultValue: 'offline',
    comment: 'online=线上作答（学生提交后教师确认）/ offline=线下录入',
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
});

Exam.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Exam.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = Exam;
