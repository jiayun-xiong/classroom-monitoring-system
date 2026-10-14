// 通知中心 API
import request from './request'

// 收件箱
export function getNotifications() {
  return request.get('/notifications')
}

// 未读数
export function getUnreadCount() {
  return request.get('/notifications/unread-count')
}

// 发送消息
export function sendNotification(data) {
  return request.post('/notifications/send', data)
}

// 标记已读
export function markRead(id) {
  return request.post(`/notifications/${id}/read`)
}

// 全部已读
export function markAllRead() {
  return request.post('/notifications/read-all')
}

// 按课程+类型标记已读（功能卡点击处理即已读）
export function markReadByType(courseId, type) {
  return request.post('/notifications/read-by-type', { courseId, type })
}

// 按类型统计未读数（功能卡角标，可按课程过滤）
export function getUnreadByType(courseId) {
  return request.get('/notifications/unread-by-type', { params: { courseId } })
}
