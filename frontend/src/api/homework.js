// 随堂作业 API
import request from './request'

// 教师：发布作业
export function createHomework(courseId, data) {
  return request.post(`/courses/${courseId}/homeworks`, data)
}

// 教师/学生：作业列表
export function getHomeworks(courseId) {
  return request.get(`/courses/${courseId}/homeworks`)
}

// 教师/学生：作业详情
export function getHomework(id) {
  return request.get(`/homeworks/${id}`)
}

// 教师：修改作业
export function updateHomework(id, data) {
  return request.put(`/homeworks/${id}`, data)
}

// 教师：删除作业
export function deleteHomework(id) {
  return request.delete(`/homeworks/${id}`)
}

// 学生：提交/重交
export function submitHomework(id, data) {
  return request.post(`/homeworks/${id}/submit`, data)
}

// 教师：批改
export function gradeHomework(id, data) {
  return request.put(`/homeworks/${id}/grade`, data)
}

// 教师：打回
export function returnHomework(id, data) {
  return request.put(`/homeworks/${id}/return`, data)
}

// 教师：豁免
export function exemptHomework(id, data) {
  return request.put(`/homeworks/${id}/exempt`, data)
}
