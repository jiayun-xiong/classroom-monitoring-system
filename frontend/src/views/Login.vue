<script setup>
// 登录页：账号密码登录 + 短信验证码登录（开发 mock）+ 第三方占位
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { sendSmsCode } from '../api/auth'

const router = useRouter()
const userStore = useUserStore()

const mode = ref('pwd') // pwd | sms
const username = ref('')
const password = ref('')
const phone = ref('')
const smsCode = ref('')
const smsMsg = ref('')
const countdown = ref(0)
const loading = ref(false)
const error = ref('')

// 快捷填充测试账号
const quickFill = (u, p) => {
  mode.value = 'pwd'
  username.value = u
  password.value = p
  error.value = ''
}

function goHome(user) {
  const pathMap = { student: '/student', teacher: '/teacher', admin: '/admin' }
  router.push(pathMap[user.role] || '/login')
}

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const user = await userStore.login({ username: username.value, password: password.value })
    goHome(user)
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}

async function handleSendCode() {
  if (!phone.value) {
    smsMsg.value = '请输入手机号'
    return
  }
  smsMsg.value = ''
  try {
    const res = await sendSmsCode(phone.value)
    smsMsg.value = (res.data && res.data.mockCode) ? `演示环境验证码：${res.data.mockCode}（请填写）` : (res.message || '验证码已发送')
    countdown.value = 60
    const t = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) clearInterval(t)
    }, 1000)
  } catch (e) {
    smsMsg.value = e.message || '发送失败'
  }
}

async function handleSmsLogin() {
  if (!phone.value || !smsCode.value) {
    error.value = '请输入手机号和验证码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const user = await userStore.smsLogin({ phone: phone.value, code: smsCode.value })
    goHome(user)
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1>课堂学情监控管理系统</h1>
      <p class="sub">学生端 / 教师端 / 管理端 统一登录</p>
      <div class="tabs">
        <button class="tab" :class="{ active: mode === 'pwd' }" @click="mode = 'pwd'; error = ''">账号密码</button>
        <button class="tab" :class="{ active: mode === 'sms' }" @click="mode = 'sms'; error = ''">短信验证码</button>
      </div>
      <div v-if="mode === 'pwd'" class="form">
        <label>用户名</label>
        <input v-model="username" placeholder="请输入用户名" @keyup.enter="handleLogin" />
        <label>密码</label>
        <input v-model="password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
        <p v-if="error" class="error">{{ error }}</p>
        <button :disabled="loading" @click="handleLogin">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </div>
      <div v-else class="form">
        <label>手机号</label>
        <div class="sms-row">
          <input v-model="phone" placeholder="请输入已注册手机号" />
          <button class="code-btn" :disabled="countdown > 0" @click="handleSendCode">
            {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
          </button>
        </div>
        <label>验证码</label>
        <input v-model="smsCode" placeholder="请输入验证码" @keyup.enter="handleSmsLogin" />
        <p v-if="smsMsg" class="sms-msg">{{ smsMsg }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <button :disabled="loading" @click="handleSmsLogin">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </div>
      <div class="divider">第三方登录（开发占位）</div>
      <div class="others">
        <button class="ghost" disabled>微信登录</button>
        <button class="ghost" disabled>QQ 登录</button>
      </div>
      <div class="quick">
        <p><b>测试账号</b>（点击填入）：</p>
        <div class="quick-btns">
          <button @click="quickFill('admin', 'admin123')">管理员 admin</button>
          <button @click="quickFill('teacher1', '123456')">教师 teacher1</button>
          <button @click="quickFill('student1', '123456')">学生 student1</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.login-card {
  width: 380px;
  background: #fff;
  border-radius: 16px;
  padding: 36px 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
h1 { font-size: 22px; text-align: center; margin: 0 0 6px; }
.sub { text-align: center; color: #6b7280; font-size: 13px; margin: 0 0 24px; }
.form label { display: block; font-size: 13px; color: #374151; margin: 12px 0 4px; }
.form input {
  width: 100%; box-sizing: border-box;
  padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px; outline: none;
}
.form input:focus { border-color: #3b82f6; }
.form button {
  width: 100%; margin-top: 20px; padding: 11px;
  background: #2563eb; color: #fff; border: none; border-radius: 8px;
  font-size: 15px; cursor: pointer;
}
.form button:disabled { opacity: 0.6; }
.error { color: #dc2626; font-size: 13px; margin: 8px 0 0; }
.divider {
  text-align: center; color: #9ca3af; font-size: 12px;
  margin: 22px 0 12px; position: relative;
}
.divider::before, .divider::after {
  content: ''; position: absolute; top: 50%; width: 30%; height: 1px; background: #e5e7eb;
}
.divider::before { left: 0; }
.divider::after { right: 0; }
.others { display: flex; gap: 8px; }
.others .ghost {
  flex: 1; padding: 8px 0; font-size: 12px; color: #6b7280;
  background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; cursor: not-allowed;
}
.quick { margin-top: 22px; padding-top: 16px; border-top: 1px dashed #e5e7eb; }
.quick p { font-size: 12px; color: #6b7280; margin: 0 0 8px; }
.quick-btns { display: flex; gap: 8px; }
.quick-btns button {
  flex: 1; padding: 6px 0; font-size: 12px;
  background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer;
}

.tabs { display: flex; gap: 8px; margin-bottom: 8px; }
.tab {
  flex: 1; padding: 9px 0; font-size: 14px; border: 1px solid #d1d5db;
  border-radius: 8px; background: #f9fafb; color: #6b7280; cursor: pointer;
}
.tab.active { background: #2563eb; color: #fff; border-color: #2563eb; font-weight: 600; }
.sms-row { display: flex; gap: 8px; }
.sms-row input { flex: 1; }
.code-btn {
  width: auto; margin-top: 0; padding: 0 12px; white-space: nowrap;
  background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 8px;
  font-size: 13px; cursor: pointer;
}
.code-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.sms-msg { color: #047857; font-size: 13px; margin: 8px 0 0; }

@media (max-width: 640px) {
  .login-card { width: 92vw; max-width: 92vw; padding: 26px 20px; }
}
</style>
