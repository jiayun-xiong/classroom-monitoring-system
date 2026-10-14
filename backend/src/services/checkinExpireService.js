// 签到过期自动归档服务
// 定期扫描"状态仍为 open 但截止时间已过"的签到：
// 1) 状态置为 closed（前端"进行中的签到"自动消失）
// 2) 对课程内无任何记录的学生补 type=absent 缺勤记录（自动归档到签到记录）
const { Op } = require('sequelize');
const Checkin = require('../models/Checkin');
const CheckinRecord = require('../models/CheckinRecord');
const ClassSession = require('../models/ClassSession');
const CourseStudent = require('../models/CourseStudent');

async function expireCheckins() {
  try {
    const now = new Date();
    const expired = await Checkin.findAll({
      where: { status: 'open', end_time: { [Op.lt]: now } },
      include: [{ model: ClassSession, as: 'session', attributes: ['course_id'] }],
    });
    for (const ch of expired) {
      try {
        ch.status = 'closed';
        await ch.save();
        const courseId = ch.session ? ch.session.course_id : null;
        if (courseId == null) {
          console.log(`[expire] 签到 #${ch.id} 已过期归档（closed，无课程归属）`);
          continue;
        }
        const students = await CourseStudent.findAll({ where: { course_id: courseId }, attributes: ['student_id'] });
        const records = await CheckinRecord.findAll({ where: { checkin_id: ch.id }, attributes: ['student_id'], raw: true });
        const done = new Set(records.map((r) => String(r.student_id)));
        let added = 0;
        for (const cs of students) {
          if (!done.has(String(cs.student_id))) {
            await CheckinRecord.create({
              checkin_id: ch.id,
              student_id: cs.student_id,
              type: 'absent',
              signed_at: now,
            });
            added += 1;
          }
        }
        console.log(`[expire] 签到 #${ch.id} 已过期归档（closed），补缺勤 ${added} 人`);
      } catch (e2) {
        console.error(`[expire] 签到 #${ch.id} 归档处理失败，已跳过该条:`, e2.message);
      }
    }
  } catch (e) {
    console.error('[expire] 签到过期处理失败:', e.message);
  }
}

module.exports = { expireCheckins };
