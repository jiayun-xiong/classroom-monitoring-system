// 课堂会话与定位签到接口
import request from './request'

// 开始上课（教师）
export function startSession(courseId) {
  return request.post(`/courses/${courseId}/session`)
}

// 结束上课（教师）
export function endSession(sessionId) {
  return request.post(`/sessions/${sessionId}/end`)
}

// 会话列表
export function getSessions(courseId) {
  return request.get(`/courses/${courseId}/sessions`)
}

// 发布签到（教师）
export function publishCheckin(sessionId, data) {
  return request.post(`/sessions/${sessionId}/checkin`, data)
}

// 学生签到
export function signCheckin(checkinId, data) {
  return request.post(`/checkins/${checkinId}/sign`, data)
}

// 签到统计（教师）
export function getCheckinStats(checkinId) {
  return request.get(`/checkins/${checkinId}/stats`)
}

// 教师补签
export function makeupCheckin(checkinId, data) {
  return request.post(`/checkins/${checkinId}/makeup`, data)
}

// 教师登记请假
export function leaveCheckin(checkinId, data) {
  return request.post(`/checkins/${checkinId}/leave`, data)
}

// 我的签到记录（学生）
export function getMyCheckins() {
  return request.get('/checkins/me')
}
