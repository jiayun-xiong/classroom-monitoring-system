<script setup>
// 学生端首页：我的课堂（点击进课堂工作台）+ 顶部全局入口（我的成绩/学情报告/铃铛）+ 加入课堂
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { getCourses } from '../../api/course'
import { getUnreadByType } from '../../api/notification'
import NotificationBell from '../../components/NotificationBell.vue'

const router = useRouter()
const userStore = useUserStore()
const list = ref([])
const loading = ref(true)
const message = ref('')

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

function openWorkbench(id) {
  router.push(`/student/courses/${id}`)
}

</script>

<template>
  <div class="page">
    <header>
      <div class="brand">课堂学情监控管理系统 · <span class="role">学生端</span></div>
      <div class="top-right">
        <span class="user">欢迎，{{ userStore.user?.name }}同学</span>
        <button class="link-btn" @click="router.push('/student/scores')">我的成绩</button>
        <button class="link-btn" @click="router.push('/student/report')">学情报告</button>
        <NotificationBell path="/student/notifications" />
        <button class="logout" @click="userStore.logout(); router.push('/login')">退出</button>
      </div>
    </header>
    <main>
      <div class="head-row">
        <h2>我的课堂</h2>
        <button class="primary" @click="router.push('/student/courses')">+ 加入课堂</button>
      </div>
      <p v-if="message" class="msg">{{ message }}</p>

      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="list.length === 0" class="empty">还没有加入课堂</div>
      <div v-else class="grid">
        <div v-for="c in list" :key="c.id" class="card" @click="openWorkbench(c.id)">
          <span v-if="c.unread" class="course-badge">{{ c.unread > 99 ? '99+' : c.unread }}</span>
          <h3>{{ c.name }} <span class="credit">{{ Number(c.credit) }} 学分</span></h3>
          <p class="meta">{{ c.semester || '-' }} · 第{{ c.weeks || '-' }}周</p>
          <p class="meta">{{ c.schedule_time || '-' }} · {{ c.location || '-' }}</p>
          <div class="foot">
            <span class="teacher">授课教师：{{ c.teacher?.name || '-' }}</span>
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
.top-right { display: flex; align-items: center; gap: 12px; }
.user { font-size: 14px; color: #374151; }
.link-btn { background: none; border: none; color: #2563eb; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 8px; }
.link-btn:hover { background: #eff6ff; }
.logout { background: none; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px; color: #374151; }
.logout:hover { background: #f8fafc; }
main { max-width: 1080px; margin: 0 auto; padding: 28px 20px; }
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0; }
.primary { background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; cursor: pointer; font-size: 14px; }
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
.foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
.teacher { color: #64748b; font-size: 12px; }
.arrow { color: #2563eb; font-size: 13px; font-weight: 600; }
.empty { text-align: center; color: #9ca3af; padding: 60px 0; font-size: 14px; }

@media (max-width: 640px) {
  header { flex-wrap: wrap; height: auto; padding: 8px 14px; row-gap: 4px; }
  .brand { width: 100%; }
  .top-right { flex-wrap: wrap; }
  .foot { justify-content: center; }
  .brand { font-size: 14px; }
  .top-right { gap: 8px; }
  main { padding: 14px 12px; }
  h2 { font-size: 18px; margin-bottom: 4px; }
  .grid { grid-template-columns: 1fr !important; }
  .card { padding: 12px 14px; }
}
</style>
