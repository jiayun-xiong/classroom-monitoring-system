// 作业豁免记录模型（对应系统设计 homework_exempts 表）
// 教师对请假等特殊学生豁免某次作业；被豁免作业不计入作业平均分
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Homework = require('./Homework');
const User = require('./User');

const HomeworkExempt = sequelize.define('homework_exempts', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  homework_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '豁免原因（如请假）',
  },
});

// 关联
HomeworkExempt.belongsTo(Homework, { foreignKey: 'homework_id', as: 'homework' });
HomeworkExempt.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

module.exports = HomeworkExempt;
