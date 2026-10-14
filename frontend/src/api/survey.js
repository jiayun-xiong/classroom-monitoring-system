// 学情调查 API
import request from './request'

// 教师：发起调查
export function createSurvey(courseId, data) {
  return request.post(`/courses/${courseId}/surveys`, data)
}

// 教师/学生：调查列表
export function getSurveys(courseId) {
  return request.get(`/courses/${courseId}/surveys`)
}

// 教师/学生：调查详情
export function getSurvey(id) {
  return request.get(`/surveys/${id}`)
}

// 学生：反馈
export function respondSurvey(id, data) {
  return request.post(`/surveys/${id}/respond`, data)
}

// 教师：实时统计
export function getSurveyStats(id) {
  return request.get(`/surveys/${id}/stats`)
}

// 教师：关闭
export function closeSurvey(id) {
  return request.put(`/surveys/${id}/close`)
}

// 教师：删除
export function deleteSurvey(id) {
  return request.delete(`/surveys/${id}`)
}
