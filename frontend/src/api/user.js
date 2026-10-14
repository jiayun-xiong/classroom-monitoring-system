// 用户管理接口
import request from './request'

// 用户列表（role/keyword/page/size）
export function getUsers(params) {
  return request.get('/users', { params })
}

// 创建用户
export function createUser(data) {
  return request.post('/users', data)
}

// 更新用户
export function updateUser(id, data) {
  return request.put(`/users/${id}`, data)
}

// 删除用户
export function deleteUser(id) {
  return request.delete(`/users/${id}`)
}

// 用户详情
export function getUser(id) {
  return request.get(`/users/${id}`)
}
