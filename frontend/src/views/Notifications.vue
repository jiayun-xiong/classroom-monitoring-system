<script setup>
// 通知中心（三端通用）：收件箱（自动业务通知 + 手动消息）+ 发送消息 + 未读/全部已读
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getNotifications, getUnreadCount, sendNotification, markRead, markAllRead } from '../api/notification'
import { getCourses } from '../api/course'

const router = useRouter()
const role = computed(() => {
  const u = JSON.parse(sessionStorage.getItem('user') || '{}')
  return u.role || ''
})
const list = ref([])
const unread = ref(0)
const message = ref('')
const loading = ref(true)
const courses = ref([])

// 发消息表单
const form = ref({ courseId: '', title: '', content: '' })
const sendTo = ref('all') // all | selected
const adminRole = ref('student')
const sending = ref(false)

const TYPE_ICON = { message: '✉️', homework: '📝', survey: '📋', exam: '📚', score: '💯', checkin: '📍' }
const TYPE_NAME = { message: '消息', homework: '作业', survey: '调查', exam: '考试', score: '成绩', checkin: '签到' }

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  loading.value = true
  try {
    const res = await getNotifications()
    list.value = res.data.list
    const u = await getUnreadCount()
    unread.value = u.data.count
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

async function loadCourses() {
  try {
    const res = await getCourses()
    courses.value = res.data.list
    if (courses.value.length) form.value.courseId = String(courses.value[0].id)
  } catch (e) {
    /* 忽略 */
  }
}

async function onRead(n) {
  if (n.isRead) return
  await markRead(n.id)
  n.isRead = true
  unread.value = Math.max(0, unread.value - 1)
  window.dispatchEvent(new CustomEvent('notify-unread-changed'))
  if (n.link) router.push(n.link)
}

async function onReadAll() {
  await markAllRead()
  unread.value = 0
  list.value.forEach((n) => (n.isRead = true))
  window.dispatchEvent(new CustomEvent('notify-unread-changed'))
}

async function onSend() {
  if (!form.value.title.trim()) {
    message.value = '请填写消息标题'
    return
  }
  sending.value = true
  message.value = ''
  try {
    const payload = {
      receiverRole: role.value === 'teacher' ? 'student' : role.value === 'student' ? 'teacher' : adminRole.value,
      courseId: form.value.courseId ? Number(form.value.courseId) : null,
      title: form.value.title,
      content: form.value.content,
      link: null,
    }
    if (role.value === 'teacher' && sendTo.value === 'selected') {
      payload.receiverIds = form.value.studentIds ? form.value.studentIds.map(Number) : []
    }
    const res = await sendNotification(payload)
    if (res.code === 0) {
      message.value = '消息已发送'
      form.value.title = ''
      form.value.content = ''
      load()
    } else {
      message.value = res.message
    }
  } catch (e) {
    message.value = '发送失败：' + e.message
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  load()
  loadCourses()
})

function goBack() { if (window.history.length > 1) router.back(); else router.push(role === 'teacher' ? '/teacher' : role === 'student' ? '/student' : '/admin') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">
        课堂学情监控管理系统 · <span class="role">{{ role === 'teacher' ? '教师端' : role === 'student' ? '学生端' : '管理员端' }}</span>
      </div>
      
    </header>
    <main>
      <h2>通知中心 <span class="badge" v-if="unread > 0">{{ unread }} 条未读</span></h2>
      <p class="tip">业务通知（作业/调查/考试/成绩/签到）与消息互发，点击未读消息可跳转对应页面</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <div class="layout">
        <!-- 收件箱 -->
        <div class="inbox">
          <div class="inbox-head">
            <span>收件箱（{{ list.length }}）</span>
            <button class="btn-mini" @click="onReadAll">全部已读</button>
          </div>
          <div v-if="loading" class="empty">加载中...</div>
          <div v-else-if="list.length === 0" class="empty">暂无通知</div>
          <div
            v-for="n in list"
            :key="n.id"
            class="n-item"
            :class="{ unread: !n.isRead }"
            @click="onRead(n)"
          >
            <span class="n-icon">{{ TYPE_ICON[n.type] || '🔔' }}</span>
            <div class="n-body">
              <div class="n-title">
                <b>{{ n.title }}</b>
                <span v-if="!n.isRead" class="dot"></span>
              </div>
              <p class="n-content">{{ n.content }}</p>
              <div class="n-meta">
                <span>{{ TYPE_NAME[n.type] || '通知' }}</span>
                <span v-if="n.courseName"> · {{ n.courseName }}</span>
                <span> · {{ n.senderName }}</span>
                <span> · {{ fmtTime(n.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 发送消息 -->
        <div class="compose">
          <h3>发送消息</h3>
          <template v-if="role === 'teacher'">
            <label class="f-label">接收对象</label>
            <select v-model="sendTo" class="f-input">
              <option value="all">全班学生</option>
              <option value="selected">指定学生（暂仅全班）</option>
            </select>
            <label class="f-label">课程</label>
            <select v-model="form.courseId" class="f-input">
              <option v-for="c in courses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
            </select>
          </template>
          <template v-else-if="role === 'student'">
            <label class="f-label">课程（发送给授课教师）</label>
            <select v-model="form.courseId" class="f-input">
              <option v-for="c in courses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
            </select>
          </template>
          <template v-else>
            <label class="f-label">接收角色</label>
            <select v-model="adminRole" class="f-input">
              <option value="student">全体学生</option>
              <option value="teacher">全体教师</option>
              <option value="admin">全体管理员</option>
            </select>
            <label class="f-label">课程（可选）</label>
            <select v-model="form.courseId" class="f-input">
              <option value="">全部课程</option>
              <option v-for="c in courses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
            </select>
          </template>
          <label class="f-label">标题</label>
          <input v-model="form.title" class="f-input" placeholder="消息标题" />
          <label class="f-label">内容</label>
          <textarea v-model="form.content" class="f-input f-textarea" placeholder="消息内容"></textarea>
          <button class="btn-send" :disabled="sending" @click="onSend">{{ sending ? '发送中...' : '发送' }}</button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; min-height: 100vh; background: #f8fafc; }
header { display: flex; justify-content: space-between; align-items: center; padding: 0 32px; height: 56px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.brand { font-size: 16px; font-weight: 600; }
.role { color: #2563eb; }
.back a { color: #2563eb; font-size: 14px; text-decoration: none; }
main { max-width: 1000px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.badge { font-size: 12px; background: #2563eb; color: #fff; padding: 3px 12px; border-radius: 20px; vertical-align: middle; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.empty { text-align: center; color: #9ca3af; padding: 30px 0; font-size: 13px; }

.layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; align-items: start; }
.inbox { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
.inbox-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-weight: 600; font-size: 14px; }
.btn-mini { border: 1px solid #d1d5db; background: #fff; color: #374151; font-size: 12px; padding: 4px 12px; border-radius: 20px; cursor: pointer; }
.btn-mini:hover { background: #f3f4f6; }
.n-item { display: flex; gap: 12px; padding: 13px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; }
.n-item:hover { background: #f8fafc; }
.n-item.unread { background: #eff6ff; }
.n-icon { font-size: 18px; }
.n-body { flex: 1; }
.n-title { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #1e293b; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #2563eb; }
.n-content { color: #4b5563; font-size: 13px; margin: 4px 0; }
.n-meta { color: #9ca3af; font-size: 11px; }

.compose { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; }
.compose h3 { font-size: 15px; margin: 0 0 12px; }
.f-label { display: block; font-size: 12px; color: #6b7280; margin: 10px 0 4px; }
.f-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; background: #fff; }
.f-textarea { min-height: 80px; resize: vertical; }
.btn-send { width: 100%; margin-top: 14px; background: #2563eb; color: #fff; border: none; padding: 10px; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-send:hover { background: #1d4ed8; }
.btn-send:disabled { opacity: 0.6; cursor: not-allowed; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }


@media (max-width: 640px) {
  header { padding: 0 14px; height: 48px; }
  .brand { font-size: 14px; }
  main { padding: 14px 12px; }
  h2 { font-size: 18px; margin-bottom: 4px; }
  .n-item { padding: 10px 12px; }
  .layout { grid-template-columns: 1fr; }
  .compose { width: auto; max-width: none; }
}
</style>
