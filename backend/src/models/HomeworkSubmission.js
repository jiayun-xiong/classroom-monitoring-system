// 作业提交记录模型（对应系统设计 homework_submissions 表）
// 每次提交/重交生成一条新记录，保留历次提交；学生维度最新一条 = 该学生该作业 id 最大的记录
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Homework = require('./Homework');
const User = require('./User');

const HomeworkSubmission = sequelize.define('homework_submissions', {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '文本内容',
  },
  attachment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '附件信息（JSON：文件名/URL/类型/大小）',
  },
  status: {
    type: DataTypes.ENUM('submitted', 'graded', 'returned'),
    allowNull: false,
    defaultValue: 'submitted',
    comment: 'submitted=已提交待批改 / graded=已批改 / returned=打回重交',
  },
  score: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true,
    comment: '批改得分',
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '批改评语或打回说明',
  },
  graded_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '批改时间',
  },
});

// 关联
HomeworkSubmission.belongsTo(Homework, { foreignKey: 'homework_id', as: 'homework' });
Homework.hasMany(HomeworkSubmission, { foreignKey: 'homework_id', as: 'submissions' });
HomeworkSubmission.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

module.exports = HomeworkSubmission;
