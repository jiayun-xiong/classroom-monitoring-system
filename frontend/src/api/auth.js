// 认证接口
import request from './request'

// 登录（用户名密码）
export function login(data) {
  return request.post('/auth/login', data)
}

// 当前用户信息
export function getMe() {
  return request.get('/auth/me')
}

// 登出
export function logout() {
  return request.post('/auth/logout')
}

// 发送短信验证码（开发模式 mock）
export function sendSmsCode(phone) {
  return request.post('/auth/sms/send', { phone })
}

// 短信验证码登录
export function smsLogin(data) {
  return request.post('/auth/sms/login', data)
}
