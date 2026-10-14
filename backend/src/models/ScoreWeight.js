// 成绩权重模型（对应系统设计 score_weights 表；三项权重之和须为 100）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Course = require('./Course');

const ScoreWeight = sequelize.define('score_weights', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
  },
  checkin_weight: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 20,
  },
  homework_weight: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 20,
  },
  exam_weight: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 60,
  },
});

// 每门课程一条权重记录
Course.hasOne(ScoreWeight, { foreignKey: 'course_id', as: 'weights' });
ScoreWeight.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

module.exports = ScoreWeight;
