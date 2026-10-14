<script setup>
// 学生端-课堂工作台：一个课堂的所有功能入口（签到/反馈/作业/调查/考试/报告/进入课堂）
// 右上角：对应类型通知未读数红底白字角标
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCourse } from '../../api/course'
import { getUnreadByType, markReadByType } from '../../api/notification'
import NotificationBell from '../../components/NotificationBell.vue'

const route = useRoute()
const router = useRouter()
const courseId = route.params.id
const course = ref(null)
const unread = ref({ message: 0, homework: 0, survey: 0, exam: 0, score: 0, checkin: 0 })
let timer = null

const entries = [
  { key: 'live', name: '进入课堂', desc: 'PPT 跟随 · 课堂弹幕', path: '/student/classroom', icon: '🎬', type: null },
  { key: 'checkin', name: '课堂定位签到', desc: '定位签到（200m 判定）', path: '/student/checkins', icon: '📍', type: 'checkin' },
  { key: 'emotion', name: '表情反馈', desc: '每知识点 6 表情反馈', path: '/student/emotions', icon: '😊', type: 'emotion' },
  { key: 'homework', name: '随堂作业', desc: '提交作业 · 查看批改', path: '/student/homeworks', icon: '📝', type: 'homework' },
  { key: 'survey', name: '学情调查', desc: '知识点评分反馈', path: '/student/surveys', icon: '📋', type: 'survey' },
  { key: 'exam', name: '期末考试与总成绩', desc: '线上作答 · 加权总分与排名', path: '/student/exams', icon: '📚', type: 'exam' },
  { key: 'report', name: '课程学情报告', desc: '总体 · 自己 · 排名', path: '/student/report', icon: '📈', type: null },
]

function openEntry(e) {
  // 点击功能卡 = 已处理该类型通知：标记已读并即时刷新角标（作业/调查/考试/签到/反馈）
  if (e.type) {
    markReadByType(courseId, e.type)
      .then(() => {
        loadUnread()
        window.dispatchEvent(new CustomEvent('notify-unread-changed'))
      })
      .catch(() => {})
  }
  router.push({ path: e.path, query: { courseId } })
}

async function loadCourse() {
  try {
    const r = await getCourse(courseId)
    course.value = r.data
  } catch (e) {
    /* 忽略 */
  }
}

async function loadUnread() {
  try {
    const r = await getUnreadByType(courseId)
    unread.value = r.data
  } catch (e) {
    /* 忽略 */
  }
}

onMounted(() => {
  loadCourse()
  loadUnread()
  timer = setInterval(loadUnread, 1000)
  window.addEventListener('notify-unread-changed', loadUnread)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('notify-unread-changed', loadUnread)
})

function goBack() { if (window.history.length > 1) router.back(); else router.push('/student') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">学生端</span></div>
      <div class="top-right">
        <NotificationBell path="/student/notifications" />
        
      </div>
    </header>
    <main>
      <div class="course-head">
        <h2>{{ course?.name || '课堂工作台' }}</h2>
      </div>

      <div class="grid">
        <div v-for="e in entries" :key="e.key" class="card" @click="openEntry(e)">
          <div class="icon">{{ e.icon }}</div>
          <div class="info">
            <h3>{{ e.name }}</h3>
            <p>{{ e.desc }}</p>
          </div>
          <span v-if="e.type && unread[e.type] > 0" class="badge">{{ unread[e.type] > 99 ? '99+' : unread[e.type] }}</span>
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
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

.card:hover { border-color: #2563eb; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.1); transform: translateY(-2px); }
.icon { font-size: 28px; }
.info h3 { margin: 0 0 4px; font-size: 16px; }
.info p { margin: 0; color: #6b7280; font-size: 13px; }
.badge {
  position: absolute; top: -6px; right: -6px;
  background: #dc2626; color: #fff; font-size: 12px; font-weight: 600;
  min-width: 20px; height: 20px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; padding: 0 5px;
}

main { max-width: 1080px; margin: 0 auto; padding: 28px 20px; }
.course-head { margin-bottom: 22px; }
.course-head h2 { font-size: 22px; margin: 0 0 6px; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.card {
  position: relative; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 20px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.15s;
}

@media (max-width: 640px) {
  header { padding: 0 14px; height: 48px; }
  .brand { font-size: 14px; }
  .top-right { gap: 8px; }
  main { padding: 14px 12px; }
  h2 { font-size: 18px; margin-bottom: 4px; }
  .grid { grid-template-columns: 1fr !important; }
  .card { padding: 12px 14px; }
}
</style>
