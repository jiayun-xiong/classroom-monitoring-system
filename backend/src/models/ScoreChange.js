// 成绩变更留痕模型（对应系统设计 score_changes 表）
// 教师/管理员修改作业或期末成绩时记录：旧值、新值、原因、操作人、时间
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Course = require('./Course');
const User = require('./User');

const ScoreChange = sequelize.define('score_changes', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  item_type: {
    type: DataTypes.ENUM('homework', 'exam'),
    allowNull: false,
    comment: 'homework=作业成绩 / exam=期末成绩',
  },
  ref_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '关联的作业或考试 id',
  },
  ref_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '作业/考试名称（快照，防改名后无法追溯）',
  },
  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  old_score: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: true,
    comment: '修改前成绩（无则为空）',
  },
  new_score: {
    type: DataTypes.DECIMAL(5, 1),
    allowNull: false,
    comment: '修改后成绩',
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '修改原因（必填）',
  },
  operator_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '操作人（教师/管理员）',
  },
});

ScoreChange.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
ScoreChange.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
ScoreChange.belongsTo(User, { foreignKey: 'operator_id', as: 'operator' });

module.exports = ScoreChange;
