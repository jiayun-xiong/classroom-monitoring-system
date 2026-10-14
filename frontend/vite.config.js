import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // 允许局域网/手机访问（同一 WiFi 下用 电脑IP:5173）
    port: 5173,
    // 开发环境代理：前端请求 /api 转发到后端，避免跨域
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 后续 Socket.IO 弹幕/讨论区走 /ws，环境搭建时预留
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
