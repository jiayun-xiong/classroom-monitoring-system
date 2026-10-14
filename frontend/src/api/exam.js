// 期末考试与总成绩 API
import request from './request'

// 教师：发布考试
export function createExam(courseId, data) {
  return request.post(`/courses/${courseId}/exams`, data)
}

// 教师/学生：考试列表
export function getExams(courseId) {
  return request.get(`/courses/${courseId}/exams`)
}

// 教师：考试成绩名单
export function getExamScores(id) {
  return request.get(`/exams/${id}/scores`)
}

// 教师：录入/确认成绩
export function saveExamScores(id, scores) {
  return request.put(`/exams/${id}/scores`, { scores })
}

// 学生：线上作答提交
export function submitExamScore(id, score) {
  return request.post(`/exams/${id}/submit`, { score })
}

// 三端：加权总成绩与排名
export function getFinalScores(courseId) {
  return request.get(`/courses/${courseId}/final`)
}
