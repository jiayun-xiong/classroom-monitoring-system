// 学生扩展信息模型（对应系统设计 students 表）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Student = sequelize.define('students', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
  },
  student_no: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  grade: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  class_name: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  major: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
});

// 关联关系：一个学生对应一个用户
Student.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(Student, { foreignKey: 'user_id', as: 'student' });

module.exports = Student;
