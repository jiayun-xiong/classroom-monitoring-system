// 课程学情报告 API
import request from './request'

// 教师/管理员：课程学情报告（总体 + 每个学生）
export function getCourseReport(courseId) {
  return request.get(`/courses/${courseId}/report`)
}

// 学生：课程学情报告（总体 + 自己 + 各项排名）
export function getMyReport(courseId) {
  return request.get(`/courses/${courseId}/report/me`)
}

// 导出学情报告 Excel（教师/管理员全量，学生仅本人）——blob 下载，绕过 axios 业务拦截器
export function exportCourseReport(courseId) {
  return fetch(`/api/courses/${courseId}/report/export`, {
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
  }).then((r) => {
    if (!r.ok) throw new Error('导出失败')
    return r.blob()
  })
}
