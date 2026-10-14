// 签到活动模型（对应系统设计 checkins 表）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ClassSession = require('./ClassSession');

const Checkin = sequelize.define('checkins', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  teacher_lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  teacher_lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  window_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('open', 'closed'),
    allowNull: false,
    defaultValue: 'open',
  },
});

Checkin.belongsTo(ClassSession, { foreignKey: 'session_id', as: 'session' });
ClassSession.hasMany(Checkin, { foreignKey: 'session_id', as: 'checkins' });

module.exports = Checkin;
