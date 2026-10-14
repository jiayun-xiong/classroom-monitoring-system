// 选课关系模型（对应系统设计 course_students 表）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Course = require('./Course');
const User = require('./User');

const CourseStudent = sequelize.define('course_students', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  joined_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

// 关系：课程-学生（多对多，通过本表）
Course.belongsToMany(User, { through: CourseStudent, foreignKey: 'course_id', otherKey: 'student_id', as: 'students' });
User.belongsToMany(Course, { through: CourseStudent, foreignKey: 'student_id', otherKey: 'course_id', as: 'joinedCourses' });
Course.hasMany(CourseStudent, { foreignKey: 'course_id', as: 'enrollments' });

module.exports = CourseStudent;
