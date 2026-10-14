// 健康检查接口（环境搭建验收用）
import request from './request'

// 后端健康检查：验证前后端连通
export function getHealth() {
  return request.get('/health')
}
