// 签到明细模型（对应系统设计 checkin_records 表）
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Checkin = require('./Checkin');
const User = require('./User');

const CheckinRecord = sequelize.define('checkin_records', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  checkin_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  distance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '与基准点距离（米）',
  },
  result: {
    type: DataTypes.ENUM('success', 'fail'),
    allowNull: true,
    comment: '定位判定结果（未操作则为空）',
  },
  type: {
    type: DataTypes.ENUM('normal', 'makeup', 'leave', 'absent', 'late'),
    allowNull: true,
    comment: '出勤类型：正常/补签/请假/缺勤/迟到（迟到计入到课）',
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '补签或请假原因',
  },
  device_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '设备标识（防代签）',
  },
  signed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

CheckinRecord.belongsTo(Checkin, { foreignKey: 'checkin_id', as: 'checkin' });
Checkin.hasMany(CheckinRecord, { foreignKey: 'checkin_id', as: 'records' });
CheckinRecord.belongsTo(User, { foreignKey: 'student_id', as: 'student' });
User.hasMany(CheckinRecord, { foreignKey: 'student_id', as: 'checkinRecords' });

module.exports = CheckinRecord;
