<script setup>
// 管理端-课堂总览：全部课堂项目（含授课教师 / 学生数 / 课堂码），点击可跳转成绩管理
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { getCourses } from '../../api/course'

const router = useRouter()
const userStore = useUserStore()
const list = ref([])
const loading = ref(true)
const message = ref('')

async function fetchList() {
  loading.value = true
  try {
    const res = await getCourses()
    list.value = res.data.list
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

function goScores(id) {
  router.push({ path: '/admin/scores', query: { courseId: id } })
}

onMounted(fetchList)

function goBack() { if (window.history.length > 1) router.back(); else router.push('/admin') }
</script>

<template>
  <div class="page">
    <header>
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">管理端</span></div>
      <div class="user">
        <span>欢迎，{{ userStore.user?.name }}管理员</span>
        <button @click="userStore.logout(); router.push('/login')">退出</button>
      </div>
    </header>
    <main>
      <h2>课堂总览</h2>
      <p class="tip">全部课堂项目一览 · 点击课程行进入该课程成绩管理</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="list.length === 0" class="empty">还没有课堂</div>
      <div v-else class="table-box">
        <div class="t-head">
          <span>课程名</span><span>授课教师</span><span>学分</span><span>学期</span><span>周次</span><span>上课时间</span><span>地点</span><span>学生数</span><span>课堂码</span>
        </div>
        <div v-for="c in list" :key="c.id" class="t-row" @click="goScores(c.id)">
          <span class="c-name">{{ c.name }}</span>
          <span>{{ c.teacher?.name || '-' }}</span>
          <span>{{ Number(c.credit) || '-' }}</span>
          <span>{{ c.semester || '-' }}</span>
          <span>第{{ c.weeks || '-' }}周</span>
          <span>{{ c.schedule_time || '-' }}</span>
          <span>{{ c.location || '-' }}</span>
          <span>{{ (c.students && c.students.length) || 0 }} 人</span>
          <span class="code">{{ c.join_code }}</span>
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
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #374151; }
.user button {
  padding: 6px 14px; background: #fff; color: #dc2626;
  border: 1px solid #fca5a5; border-radius: 6px; cursor: pointer; font-size: 13px;
}
main { max-width: 1200px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 16px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }
.table-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
.t-head, .t-row {
  display: grid; grid-template-columns: 1.6fr 1fr 0.6fr 0.9fr 0.8fr 1.4fr 0.9fr 0.7fr 0.9fr;
  gap: 10px; align-items: center; padding: 12px 16px; font-size: 13px;
}
.t-head { background: #f8fafc; color: #6b7280; font-weight: 600; }
.t-row { border-top: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; }
.t-row:hover { background: #eff6ff; }
.c-name { font-weight: 600; color: #1e293b; }
.code { color: #1d4ed8; font-family: monospace; letter-spacing: 2px; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
}
.back:hover { background: #f8fafc; }
</style>
