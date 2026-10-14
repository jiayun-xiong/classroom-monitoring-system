// 期末考试成绩模型（对应系统设计 exam_scores 表）
// 每个学生一条（upsert）；source 标记成绩来源：teacher=教师录入/确认，student=学生线上提交
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Exam = require('./Exam');
const User = require('./User');

const ExamScore = sequelize.define('exam_scores', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  exam_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  score: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: false,
    comment: '成绩（按满分折算百分制计算总成绩）',
  },
  source: {
    type: DataTypes.ENUM('teacher', 'student'),
    allowNull: false,
    defaultValue: 'teacher',
    comment: 'teacher=教师录入/确认 / student=学生线上提交（待教师确认）',
  },
});

Exam.hasMany(ExamScore, { foreignKey: 'exam_id', as: 'scores' });
ExamScore.belongsTo(Exam, { foreignKey: 'exam_id', as: 'exam' });
ExamScore.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

module.exports = ExamScore;
