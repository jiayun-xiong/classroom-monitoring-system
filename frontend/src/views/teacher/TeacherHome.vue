<script setup>
// 教师端首页：我的课堂（课堂工作台入口）+ 右上角通知铃铛 + 新建课堂
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { getCourses, createCourse } from '../../api/course'
import { getUnreadByType } from '../../api/notification'
import NotificationBell from '../../components/NotificationBell.vue'

const router = useRouter()
const userStore = useUserStore()
const list = ref([])
const loading = ref(true)
const message = ref('')
const showDialog = ref(false)
const submitting = ref(false)
const form = ref({})

function resetForm() {
  form.value = {
    name: '', semester: '', weeks: '', scheduleTime: '', location: '',
    credit: 3.0, checkinWeight: 20, homeworkWeight: 20, examWeight: 60,
  }
}

// 每门课待办角标：该课程全部类型未读数之和（只刷新未读，不重拉课程）
async function refreshUnread() {
  if (!list.value.length) return
  await Promise.all(
    list.value.map(async (c) => {
      try {
        const r = await getUnreadByType(c.id)
        c.unread = Object.values(r.data || {}).reduce((a, b) => a + b, 0)
      } catch (e) {
        c.unread = 0
      }
    })
  )
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getCourses()
    list.value = res.data.list
    await refreshUnread()
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

let unreadTimer = null
onMounted(() => {
  fetchList()
  unreadTimer = setInterval(refreshUnread, 1000)
  window.addEventListener('notify-unread-changed', refreshUnread)
})
onBeforeUnmount(() => {
  if (unreadTimer) clearInterval(unreadTimer)
  window.removeEventListener('notify-unread-changed', refreshUnread)
})

function openCreate() {
  resetForm()
  showDialog.value = true
}

async function submitCreate() {
  message.value = ''
  if (!form.value.name) {
    message.value = '请填写课程名称'
    return
  }
  const sum = Number(form.value.checkinWeight) + Number(form.value.homeworkWeight) + Number(form.value.examWeight)
  if (sum !== 100) {
    message.value = `权重合计必须为 100，当前为 ${sum}`
    return
  }
  submitting.value = true
  try {
    const res = await createCourse(form.value)
    if (res.code !== 0) {
      message.value = res.message
      return
    }
    showDialog.value = false
    await fetchList()
  } catch (e) {
    message.value = e.message
  } finally {
    submitting.value = false
  }
}

function openDetail(id) {
  router.push(`/teacher/courses/${id}`)
}

</script>

<template>
  <div class="page">
    <header>
      <div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      <div class="top-right">
        <span class="user">欢迎，{{ userStore.user?.name }}老师</span>
        <NotificationBell path="/teacher/notifications" />
        <button class="logout" @click="userStore.logout(); router.push('/login')">退出</button>
      </div>
    </header>
    <main>
      <div class="head-row">
        <h2>我的课堂</h2>
        <button class="primary" @click="openCreate">+ 新建课堂</button>
      </div>
      <p v-if="message" class="msg">{{ message }}</p>

      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="list.length === 0" class="empty">还没有课堂</div>
      <div v-else class="grid">
        <div v-for="c in list" :key="c.id" class="card" @click="openDetail(c.id)">
          <span v-if="c.unread" class="course-badge">{{ c.unread > 99 ? '99+' : c.unread }}</span>
          <h3>{{ c.name }} <span class="credit">{{ Number(c.credit) }} 学分</span></h3>
          <p class="meta">{{ c.semester || '-' }} · 第{{ c.weeks || '-' }}周</p>
          <p class="meta">{{ c.schedule_time || '-' }} · {{ c.location || '-' }}</p>
        </div>
      </div>

      <!-- 新建课堂弹窗 -->
      <div v-if="showDialog" class="mask" @click.self="showDialog = false">
        <div class="dialog">
          <h3>新建课堂</h3>
          <div class="form-grid">
            <label class="full">课程名称 *<input v-model="form.name" placeholder="如：高级软件工程" /></label>
            <label>学期<input v-model="form.semester" placeholder="如：2026秋季" /></label>
            <label>周次<input v-model="form.weeks" placeholder="如：1-16" /></label>
            <label>上课时间<input v-model="form.scheduleTime" placeholder="如：周一 08:00-09:40" /></label>
            <label>上课地点<input v-model="form.location" placeholder="如：三教 301" /></label>
            <label>学分<input v-model.number="form.credit" type="number" step="0.5" placeholder="如：3" /></label>
            <label class="full weight-title">成绩权重（合计必须为 100）</label>
            <label>签到 %<input v-model.number="form.checkinWeight" type="number" /></label>
            <label>作业 %<input v-model.number="form.homeworkWeight" type="number" /></label>
            <label>期末 %<input v-model.number="form.examWeight" type="number" /></label>
          </div>
          <div class="dialog-btns">
            <button class="ghost" @click="showDialog = false">取消</button>
            <button class="primary" :disabled="submitting" @click="submitCreate">{{ submitting ? '创建中...' : '创建课堂' }}</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; min-height: 100vh; background: #f8fafc; }
header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 32px; height: 56px; background: #fff; border-bottom: 1px solid #e5e7eb;
}
.brand { font-size: 16px; font-weight: 600; }
.role { color: #2563eb; }
.top-right { display: flex; align-items: center; gap: 14px; }
.user { font-size: 14px; color: #374151; }
.logout { background: none; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px; color: #374151; }
.logout:hover { background: #f8fafc; }
main { max-width: 1080px; margin: 0 auto; padding: 28px 20px; }
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0; }
.primary { background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; cursor: pointer; font-size: 14px; }
.primary:disabled { opacity: 0.6; }
.msg { color: #dc2626; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.card {
  position: relative;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px;
  cursor: pointer; transition: box-shadow 0.2s;
}
.course-badge {
  position: absolute; top: -6px; right: -6px;
  background: #dc2626; color: #fff; font-size: 12px; font-weight: 600;
  min-width: 20px; height: 20px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; padding: 0 5px;
}
.card:hover { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08); }
.card h3 { margin: 0 0 10px; font-size: 16px; }
.credit { font-size: 12px; color: #2563eb; background: #eff6ff; border-radius: 20px; padding: 2px 10px; margin-left: 6px; }
.meta { color: #6b7280; font-size: 13px; margin: 3px 0; }
.empty { text-align: center; color: #9ca3af; padding: 60px 0; font-size: 14px; }

.mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50; }
.dialog { background: #fff; border-radius: 14px; padding: 24px 28px; width: 560px; max-width: 92vw; max-height: 88vh; overflow-y: auto; }
.dialog h3 { margin: 0 0 16px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid label { display: flex; flex-direction: column; font-size: 13px; color: #374151; gap: 4px; }
.form-grid .full { grid-column: 1 / -1; }
.form-grid input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.weight-title { color: #2563eb; margin-top: 6px; }
.dialog-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.ghost { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 18px; cursor: pointer; font-size: 13px; }
</style>
