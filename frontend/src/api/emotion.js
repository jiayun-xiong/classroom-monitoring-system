// 表情反馈与学情统计接口（反馈轮次模式）
import request from './request'

// 教师：开启学情反馈轮次（选知识点 + 设时长）
export function openEmotionRound(sessionId, knowledgePoint, durationMinutes) {
  return request.post(`/sessions/${sessionId}/emotion/round`, { knowledge_point: knowledgePoint, duration_minutes: durationMinutes })
}

// 教师：关闭反馈轮次
export function closeEmotionRound(roundId) {
  return request.post(`/rounds/${roundId}/close`, {})
}

// 学生：查询会话当前开放反馈轮次
export function getActiveRound(sessionId) {
  return request.get(`/sessions/${sessionId}/emotion/round/active`)
}

// 学生：向轮次提交表情（1-6 分）
export function submitRoundEmotion(roundId, score) {
  return request.post(`/rounds/${roundId}/emotion`, { score })
}

// 教师/管理员：轮次统计（总人数/已提交/未提交名单细分/平均/方差/分布）
export function getRoundStats(roundId) {
  return request.get(`/rounds/${roundId}/stats`)
}

// 教师：生成轮次快照
export function snapshotRound(roundId) {
  return request.post(`/rounds/${roundId}/stats/snapshot`, {})
}

// 教师/管理员：轮次快照历史
export function getRoundSnapshots(roundId) {
  return request.get(`/rounds/${roundId}/stats/snapshots`)
}

// 学生：我的表情历史（含知识点）
export function getMyEmotions() {
  return request.get('/emotions/me')
}
