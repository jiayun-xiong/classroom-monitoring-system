// Axios 统一封装：基础配置 + JWT 拦截器（后续登录模块接入）
import axios from 'axios'

// 通过 vite proxy 同源访问后端，无需写完整地址
const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截：自动携带 JWT（登录后写入 sessionStorage，每个窗口独立，可双端同时登录）
request.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一处理业务码与 401
request.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.code !== 0) {
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem('token')
      // 后续接入路由后跳转登录页
    }
    return Promise.reject(error)
  }
)

export default request
