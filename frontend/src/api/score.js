// 成绩管理 API
import request from './request'

// 学生：我的成绩明细（只读）
export function getMyScores(courseId) {
  return request.get(`/courses/${courseId}/scores/me`)
}

// 教师/管理员：班级成绩明细
export function getCourseScores(courseId) {
  return request.get(`/courses/${courseId}/scores`)
}

// 教师/管理员：修改成绩（homework/exam，必填原因留痕）
export function updateScore(courseId, itemType, data) {
  return request.put(`/courses/${courseId}/scores/${itemType}`, data)
}

// 教师/管理员：变更留痕
export function getScoreChanges(courseId) {
  return request.get(`/courses/${courseId}/score-changes`)
}
