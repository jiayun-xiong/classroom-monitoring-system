// 学情统计快照模型（对应系统设计 stat_snapshots 表）
// 按周期保存会话学情快照，供历史趋势与课程报告使用
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ClassSession = require('./ClassSession');

const StatSnapshot = sequelize.define('stat_snapshots', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  round_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '所属反馈轮次（升级后快照按轮次生成；旧数据为空）',
  },
  period_start: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  period_end: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  submit_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '提交人数（按学生最新记录聚合）',
  },
  avg_score: {
    type: DataTypes.DECIMAL(3, 1),
    allowNull: true,
    comment: '班级平均分',
  },
  variance: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    comment: '分数方差',
  },
  dist_json: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '1-6 分分布 JSON（冗余，便于报告直接读取）',
  },
});

StatSnapshot.belongsTo(ClassSession, { foreignKey: 'session_id', as: 'session' });
ClassSession.hasMany(StatSnapshot, { foreignKey: 'session_id', as: 'snapshots' });

module.exports = StatSnapshot;
