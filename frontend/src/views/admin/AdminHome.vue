<script setup>
// 管理端首页：欢迎 + 功能导航（模块进度占位）
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import NotificationBell from '../../components/NotificationBell.vue'

const router = useRouter()
const userStore = useUserStore()

const features = [
  { name: '用户管理', desc: '创建 / 编辑 / 停用账号', done: true, path: '/admin/users' },
  { name: '课堂总览', desc: '全部课堂项目 / 授课教师 / 学生数', done: true, path: '/admin/courses' },
  { name: '成绩管理', desc: '选择课程查看 / 修改成绩（留痕）', done: true, path: '/admin/scores' },
  { name: '课程学情报告', desc: '选择课程查看总体 / 个体可视化', done: true, path: '/admin/report' },
  { name: '系统通知', desc: '向用户广播通知', done: true, path: '/admin/notifications' },
  { name: '统计周期配置', desc: '学情统计周期（按周/按月/自定义）', done: true, path: '/admin/stats-periods' },
]

function openFeature(f) {
  if (f.done) return router.push(f.path)
  alert(`「${f.name}」将在后续模块开发中开放（当前进度：02-用户管理与权限）`)
}
</script>

<template>
  <div class="layout">
    <header>
      <div class="brand">课堂学情监控管理系统 · <span class="role">管理端</span></div>
      <div class="user">
        <NotificationBell path="/admin/notifications" />
        <span>{{ userStore.user?.name }}（{{ userStore.user?.username }}）</span>
        <button @click="userStore.logout(); router.push('/login')">退出登录</button>
      </div>
    </header>
    <main>
      <h2>欢迎，{{ userStore.user?.name }}管理员 👋</h2>
      <p class="tip">系统管理工作台</p>
      <div class="grid">
        <div v-for="f in features" :key="f.name" class="card" @click="openFeature(f)">
          <h3>{{ f.name }}</h3>
          <p>{{ f.desc }}</p>
          <span class="badge" :class="{ done: f.done }">{{ f.done ? '已上线' : '待开发' }}</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; min-height: 100vh; background: #f8fafc; }
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
main { max-width: 1080px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 14px; margin: 0 0 24px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 18px; cursor: pointer; transition: box-shadow 0.2s;
}
.card:hover { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08); }
.card h3 { margin: 0 0 6px; font-size: 16px; }
.card p { margin: 0 0 12px; color: #6b7280; font-size: 13px; }
.badge {
  font-size: 12px; padding: 2px 10px; border-radius: 99px;
  background: #fef3c7; color: #b45309;
}
.badge.done { background: #d1fae5; color: #047857; }
</style>
