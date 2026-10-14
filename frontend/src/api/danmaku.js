// 讨论区与弹幕 API
import request from './request'

// 课堂状态（上课中会话/暂停/页码/匿名）
export function getClassroomStatus(courseId) {
  return request.get(`/courses/${courseId}/danmaku/status`)
}

// 弹幕列表（多来源）
export function getDanmaku(courseId, sources) {
  const q = sources && sources.length ? `?sources=${sources.join(',')}` : ''
  return request.get(`/courses/${courseId}/danmaku${q}`)
}

// 发送弹幕/讨论
export function sendDanmaku(courseId, data) {
  return request.post(`/courses/${courseId}/danmaku`, data)
}

// 点赞/取消点赞
export function toggleLike(id) {
  return request.post(`/danmaku/${id}/like`)
}

// 老师：暂停/恢复
export function setDanmakuPause(courseId, paused) {
  return request.post(`/courses/${courseId}/danmaku/pause`, { paused })
}

// 老师：匿名开关
export function setDanmakuAnonymous(courseId, enabled) {
  return request.post(`/courses/${courseId}/danmaku/anonymous`, { enabled })
}

// 老师：PPT 页码同步
export function setDanmakuPage(courseId, page) {
  return request.post(`/courses/${courseId}/danmaku/page`, { page })
}
