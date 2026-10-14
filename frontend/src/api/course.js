// 课堂项目接口
import request from './request'

// 创建课堂（教师）
export function createCourse(data) {
  return request.post('/courses', data)
}

// 课程列表（教师=我的 / 学生=我加入的）
export function getCourses() {
  return request.get('/courses')
}

// 课程详情
export function getCourse(id) {
  return request.get(`/courses/${id}`)
}

// 更新课程
export function updateCourse(id, data) {
  return request.put(`/courses/${id}`, data)
}

// 学生加入课堂（仅凭课堂码）
export function joinCourse(joinCode) {
  return request.post('/courses/join', { joinCode })
}

// 课堂二维码
export function getQrcode(id) {
  return request.get(`/courses/${id}/qrcode`)
}

// 刷新课堂码
export function refreshCode(id) {
  return request.post(`/courses/${id}/refresh-code`)
}

// 设置权重
export function updateWeights(id, data) {
  return request.put(`/courses/${id}/weights`, data)
}

// 教师移出学生
export function removeStudent(courseId, studentId) {
  return request.delete(`/courses/${courseId}/students/${studentId}`)
}

// 学生退出课堂
export function leaveCourse(id) {
  return request.delete(`/courses/${id}/me`)
}
