// 课堂项目模型（对应系统设计 courses 表）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Course = sequelize.define('courses', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  teacher_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  semester: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  weeks: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  schedule_time: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  credit: {
    type: DataTypes.DECIMAL(3, 1),
    allowNull: false,
    defaultValue: 3.0,
    comment: '课程学分',
  },
  join_code: {
    type: DataTypes.STRING(6),
    allowNull: false,
    unique: true,
  },
  join_code_expire: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  anonymous_live: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '实时弹幕是否匿名（老师控制，仅作用于 live 来源）',
  },
  status: {
    type: DataTypes.ENUM('active', 'archived'),
    allowNull: false,
    defaultValue: 'active',
    comment: '课程状态：active 正常 / archived 已归档隐藏（保留教学数据）',
  },
});

// 授课教师
Course.belongsTo(User, { foreignKey: 'teacher_id', as: 'teacher' });
User.hasMany(Course, { foreignKey: 'teacher_id', as: 'courses' });

module.exports = Course;
