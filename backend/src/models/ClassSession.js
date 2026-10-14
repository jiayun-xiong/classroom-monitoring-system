// 课堂会话模型（对应系统设计 class_sessions 表）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Course = require('./Course');

const ClassSession = sequelize.define('class_sessions', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  session_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  week_no: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('ongoing', 'ended'),
    allowNull: false,
    defaultValue: 'ongoing',
  },
  emotion_open: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '表情反馈通道开关（教师可随时停止/恢复）',
  },
});

ClassSession.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Course.hasMany(ClassSession, { foreignKey: 'course_id', as: 'sessions' });

module.exports = ClassSession;
