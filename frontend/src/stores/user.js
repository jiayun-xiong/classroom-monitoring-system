// 用户状态（pinia）：登录态、角色、当前用户
import { defineStore } from 'pinia'
import { login as loginApi, getMe, logout as logoutApi, smsLogin as smsLoginApi } from '../api/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: sessionStorage.getItem('token') || '',
    user: JSON.parse(sessionStorage.getItem('user') || 'null'),
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    role: (state) => state.user?.role || '',
  },
  actions: {
    async login(form) {
      const res = await loginApi(form)
      this.token = res.data.token
      this.user = res.data.user
      sessionStorage.setItem('token', res.data.token)
      sessionStorage.setItem('user', JSON.stringify(res.data.user))
      return res.data.user
    },
    async smsLogin(form) {
      const res = await smsLoginApi(form)
      this.token = res.data.token
      this.user = res.data.user
      sessionStorage.setItem('token', res.data.token)
      sessionStorage.setItem('user', JSON.stringify(res.data.user))
      return res.data.user
    },
    async fetchMe() {
      const res = await getMe()
      this.user = res.data.user
      sessionStorage.setItem('user', JSON.stringify(res.data.user))
    },
    async logout() {
      try {
        await logoutApi()
      } catch (e) {
        // 忽略登出接口异常，本地仍清除
      }
      this.token = ''
      this.user = null
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
    },
  },
})
