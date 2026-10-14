// 统计周期配置模型（管理员端：学情统计周期配置，作用于学情统计的周期口径）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StatsPeriodConfig = sequelize.define('stats_period_configs', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '配置名称，如 2026-2027-1 按月统计',
  },
  period_type: {
    type: DataTypes.ENUM('weekly', 'monthly', 'custom'),
    allowNull: false,
    defaultValue: 'weekly',
    comment: '周期类型：weekly 按周 / monthly 按月 / custom 自定义区间',
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '自定义区间起始日期（custom 使用）',
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '自定义区间结束日期（custom 使用）',
  },
  semester: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '学年学期，为空表示全局生效',
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '是否启用',
  },
}, {
  tableName: 'stats_period_configs',
  timestamps: true,
});

module.exports = StatsPeriodConfig;
