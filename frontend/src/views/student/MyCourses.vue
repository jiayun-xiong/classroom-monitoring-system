<script setup>
const router = useRouter()
// 学生端-我的课堂：加入课堂（课堂码）+ 我的课堂列表
import { onMounted, ref } from 'vue'
import { getCourses, joinCourse, leaveCourse } from '../../api/course'
import { useRouter } from 'vue-router'

const list = ref([])
const loading = ref(false)
const joinCode = ref('')
const message = ref('')
const joining = ref(false)

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

async function join() {
  if (!joinCode.value) {
    message.value = '请输入课堂码'
    return
  }
  joining.value = true
  message.value = ''
  try {
    const res = await joinCourse(joinCode.value)
    message.value = `加入成功：${res.data.name}`
    joinCode.value = ''
    fetchList()
  } catch (e) {
    message.value = e.message
  } finally {
    joining.value = false
  }
}

async function leave(c) {
  if (!confirm(`确定退出「${c.name}」？退出后将无法查看该课堂，需重新用课堂码加入。`)) return
  try {
    await leaveCourse(c.id)
    message.value = `已退出「${c.name}」`
    fetchList()
  } catch (e) {
    message.value = e.message
  }
}

onMounted(fetchList)

function goBack() { if (window.history.length > 1) router.back(); else router.push('/student') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">学生端</span></div>
      
    </header>
    <main>
      <div class="join-box">
        <h2>加入课堂</h2>
        <p class="tip">向老师获取 6 位课堂码，输入后即可加入</p>
        <div class="join-row">
          <input v-model="joinCode" placeholder="输入 6 位课堂码" maxlength="6" @keyup.enter="join" />
          <button class="primary" :disabled="joining" @click="join">{{ joining ? '加入中...' : '加入课堂' }}</button>
        </div>
        <p v-if="message" class="msg" :class="{ err: message.includes('失败') || message.includes('不存在') || message.includes('过期') }">{{ message }}</p>
      </div>

      <h3 class="list-title">我的课堂（{{ list.length }} 门）</h3>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="list.length === 0" class="empty">还没有加入任何课堂</div>
      <div v-else class="grid">
        <div v-for="c in list" :key="c.id" class="card">
          <h3>{{ c.name }} <span class="credit">{{ Number(c.credit) }} 学分</span></h3>
          <p class="meta">{{ c.teacher?.name || '教师' }} · {{ c.semester || '-' }}</p>
          <p class="meta">{{ c.schedule_time || '-' }} · {{ c.location || '-' }}</p>
          <div class="foot">
            <span class="code">课堂码 {{ c.join_code }}</span>
            <span class="weight">签到{{ c.weights?.checkin_weight }}%/作业{{ c.weights?.homework_weight }}%/期末{{ c.weights?.exam_weight }}%</span>
          </div>
          <button class="leave" @click.stop="leave(c)">退出课程</button>
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
.back a { color: #2563eb; font-size: 14px; text-decoration: none; }
main { max-width: 1080px; margin: 0 auto; padding: 28px 20px; }
.join-box {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
  padding: 26px; margin-bottom: 28px;
}
h2 { font-size: 20px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 14px; margin: 0 0 16px; }
.join-row { display: flex; gap: 12px; }
.join-row input {
  flex: 1; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 10px;
  font-size: 18px; letter-spacing: 4px; text-align: center; outline: none; text-transform: uppercase;
}
.join-row input:focus { border-color: #2563eb; }
.primary {
  padding: 12px 28px; background: #2563eb; color: #fff; border: none;
  border-radius: 10px; font-size: 15px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; }
.msg { color: #047857; font-size: 13px; margin-top: 12px; }
.msg.err { color: #dc2626; }
.list-title { font-size: 16px; margin: 0 0 14px; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
.card h3 { margin: 0 0 8px; font-size: 16px; }
.credit {
  display: inline-block; font-size: 12px; font-weight: 500; color: #047857;
  background: #ecfdf5; border-radius: 6px; padding: 2px 8px; margin-left: 8px; vertical-align: middle;
}
.meta { color: #6b7280; font-size: 13px; margin: 4px 0; }
.foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e5e7eb; }
.code { background: #eff6ff; color: #1d4ed8; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
.weight { color: #9ca3af; font-size: 12px; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; }
.leave {
  margin-top: 12px; width: 100%; padding: 8px 0;
  background: #fff; color: #dc2626; border: 1px solid #fca5a5;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.leave:hover { background: #fef2f2; }
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
  .grid { grid-template-columns: 1fr !important; }
  .card { padding: 12px 14px; }
  .join-box { flex-direction: column; }
}
</style>
