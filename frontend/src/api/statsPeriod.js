// 统计周期配置 API
import request from './request'

// 管理员：配置列表
export function listStatsPeriods() {
  return request.get('/stats-periods')
}

// 管理员：新增配置
export function createStatsPeriod(data) {
  return request.post('/stats-periods', data)
}

// 管理员：更新配置
export function updateStatsPeriod(id, data) {
  return request.put(`/stats-periods/${id}`, data)
}

// 管理员：删除配置
export function deleteStatsPeriod(id) {
  return request.delete(`/stats-periods/${id}`)
}

// 任意登录用户：当前生效统计周期
export function getCurrentStatsPeriod(semester) {
  return request.get('/stats-periods/current', { params: semester ? { semester } : {} })
}
