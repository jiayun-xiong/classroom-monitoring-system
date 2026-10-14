// 通知服务：供各控制器调用的轻量通知写入工具（避免重复代码）
// notifyStudents：通知某课程全班学生（自动触发：作业/调查/考试发布等）
// notifyTeacher：通知某课程授课教师（自动触发：学生提交/补签/请假等）
// notifyUser：通知指定用户（成绩修改等）
const Notification = require('../models/Notification');
const CourseStudent = require('../models/CourseStudent');

async function notifyStudents({ courseId, type, title, content, link, senderId, senderRole = 'system' }) {
  await Notification.create({
    course_id: courseId,
    sender_id: senderId || null,
    sender_role: senderRole,
    receiver_id: null, // 全班学生
    receiver_role: 'student',
    type,
    title,
    content: content || '',
    link: link || null,
  });
}

async function notifyTeacher({ courseId, type, title, content, link, senderId, senderRole }) {
  await Notification.create({
    course_id: courseId,
    sender_id: senderId || null,
    sender_role: senderRole || 'system',
    receiver_id: null, // 该课程教师（前端按授课教师身份过滤 course_id 即可见）
    receiver_role: 'teacher',
    type,
    title,
    content: content || '',
    link: link || null,
  });
}

async function notifyUser({ userId, courseId, type, title, content, link, senderId, senderRole = 'system', receiverRole = 'student' }) {
  await Notification.create({
    course_id: courseId || null,
    sender_id: senderId || null,
    sender_role: senderRole,
    receiver_id: userId,
    receiver_role: receiverRole,
    type,
    title,
    content: content || '',
    link: link || null,
  });
}

async function notifyRole({ role, courseId, type, title, content, link, senderId, senderRole = 'system' }) {
  await Notification.create({
    course_id: courseId || null,
    sender_id: senderId || null,
    sender_role: senderRole,
    receiver_id: null,
    receiver_role: role,
    type,
    title,
    content: content || '',
    link: link || null,
  });
}

module.exports = { notifyStudents, notifyTeacher, notifyUser, notifyRole };
