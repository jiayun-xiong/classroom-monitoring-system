<script setup>
const router = useRouter()
// 教师端-课堂详情（工作台）：成绩权重置顶 → 功能入口区 → 课堂码（长期有效）+ 学生名单
// 课堂码刷新权限归管理员，教师端不提供刷新按钮
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getCourse, getQrcode, updateWeights, removeStudent } from '../../api/course'
import { getUnreadByType, markReadByType } from '../../api/notification'
import NotificationBell from '../../components/NotificationBell.vue'
import { useRouter } from 'vue-router'

const route = useRoute()
const courseId = route.params.id

const course = ref(null)
const qrcodeUrl = ref('')
const message = ref('')

// 权重编辑
const weights = ref({ checkinWeight: 20, homeworkWeight: 20, examWeight: 60 })

// 功能入口（一行一行）
const entries = [
  { name: '开始上课 / 课堂弹幕', desc: 'PPT 展示 + 课堂弹幕流', path: `classroom`, icon: '🎬', hot: true, type: null },
  { name: '课堂定位签到', desc: '发布定位签到 / 补签 / 请假', path: `checkins`, icon: '📍', type: 'checkin' },
  { name: '表情学情统计', desc: '实时反馈轮次 / 统计名单', path: `emotions`, icon: '😊', type: 'emotion' },
  { name: '随堂作业', desc: '发布作业 / 批改打回', path: `homeworks`, icon: '📝', type: 'homework' },
  { name: '学情调查', desc: '发布知识点调查', path: `surveys`, icon: '📋', type: 'survey' },
  { name: '期末考试与总成绩', desc: '发布考试 / 权重计算', path: `exams`, icon: '📚', type: 'exam' },
  { name: '成绩管理', desc: '修改成绩（留痕）', path: `scores`, icon: '📊', type: 'score' },
  { name: '课程学情报告', desc: '总体 / 个体可视化', path: `report`, icon: '📈', type: null },
]
const unread = ref({ message: 0, homework: 0, survey: 0, exam: 0, score: 0, checkin: 0, emotion: 0 })
let unreadTimer = null

async function loadUnread() {
  try {
    const r = await getUnreadByType(courseId)
    unread.value = r.data
  } catch (e) { /* 忽略 */ }
}

// 点击功能卡 = 已处理该类型通知：标记已读并即时刷新角标
function onEntryClick(e) {
  if (!e.type) return
  markReadByType(courseId, e.type)
    .then(() => {
      loadUnread()
      window.dispatchEvent(new CustomEvent('notify-unread-changed'))
    })
    .catch(() => {})
}

async function fetchDetail() {
  try {
    const res = await getCourse(courseId)
    course.value = res.data.course
    const w = course.value.weights
    if (w) weights.value = { checkinWeight: Number(w.checkin_weight), homeworkWeight: Number(w.homework_weight), examWeight: Number(w.exam_weight) }
  } catch (e) {
    message.value = '加载失败：' + e.message
  }
}

async function fetchQrcode() {
  try {
    const res = await getQrcode(courseId)
    qrcodeUrl.value = res.data.qrcodeUrl
    course.value.join_code = res.data.joinCode
  } catch (e) {
    message.value = e.message
  }
}

async function saveWeights() {
  message.value = ''
  const sum = Number(weights.value.checkinWeight) + Number(weights.value.homeworkWeight) + Number(weights.value.examWeight)
  if (sum !== 100) {
    message.value = `权重之和必须为 100，当前 ${sum}`
    return
  }
  try {
    await updateWeights(courseId, weights.value)
    message.value = '权重已更新'
    fetchDetail()
  } catch (e) {
    message.value = e.message
  }
}

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function remove(s) {
  if (!confirm(`确定将「${s.name}（${s.username}）」移出课堂？移出后该学生将无法查看本课堂。`)) return
  try {
    await removeStudent(courseId, s.id)
    message.value = `已移出 ${s.name}`
    fetchDetail()
  } catch (e) {
    message.value = e.message
  }
}

onMounted(() => {
  fetchDetail()
  fetchQrcode()
  loadUnread()
  unreadTimer = setInterval(loadUnread, 1000)
  window.addEventListener('notify-unread-changed', loadUnread)
})
onBeforeUnmount(() => {
  if (unreadTimer) clearInterval(unreadTimer)
  window.removeEventListener('notify-unread-changed', loadUnread)
})

function goBack() { if (window.history.length > 1) router.back(); else router.push('/teacher') }
</script>

<template>
  <div class="page">
    <header>
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      <NotificationBell path="/teacher/notifications" />
    </header>
    <main v-if="course">
      <div class="course-head">
        <h2>{{ course.name }} <span class="credit">{{ Number(course.credit) }} 学分</span></h2>
        <p class="tip">{{ course.semester || '-' }} · 第{{ course.weeks || '-' }}周 · {{ course.schedule_time || '-' }} · {{ course.location || '-' }}</p>
      </div>
      <p v-if="message" class="msg">{{ message }}</p>

      <!-- 成绩权重（最上面） -->
      <section class="card weight-card">
        <h3>成绩权重（合计 100，影响总成绩计算）</h3>
        <div class="weight-row">
          <div class="weight-form">
            <label>签到 %<input v-model.number="weights.checkinWeight" type="number" /></label>
            <label>作业 %<input v-model.number="weights.homeworkWeight" type="number" /></label>
            <label>期末 %<input v-model.number="weights.examWeight" type="number" /></label>
          </div>
          <button class="primary" @click="saveWeights">保存权重</button>
        </div>
      </section>

      <!-- 功能入口（一行一行） -->
      <section class="card entries-card">
        <h3>课堂功能</h3>
        <div class="entry-grid">
          <router-link
            v-for="e in entries"
            :key="e.name"
            :to="`/teacher/courses/${courseId}/${e.path}`"
            class="entry"
            :class="{ hot: e.hot }"
            @click="onEntryClick(e)"
          >
            <span v-if="e.type && unread[e.type] > 0" class="badge">{{ unread[e.type] > 99 ? '99+' : unread[e.type] }}</span>
            <span class="e-icon">{{ e.icon }}</span>
            <div class="e-text">
              <b>{{ e.name }}</b>
              <p>{{ e.desc }}</p>
            </div>
            <span class="e-arrow">›</span>
          </router-link>
        </div>
      </section>

      <!-- 课堂码（从上往下：标题 / 二维码 / 6 位码） -->
      <section class="card code-card">
        <h3>课程码</h3>
        <div class="code-box">
          <img v-if="qrcodeUrl" :src="qrcodeUrl" class="qr" alt="课堂二维码" />
          <p class="code">{{ course.join_code }}</p>
        </div>
      </section>

      <section class="card list-card">
        <h3>学生名单（{{ course.students?.length || 0 }} 人）</h3>
        <table v-if="course.students?.length">
          <thead><tr><th>姓名</th><th>用户名</th><th>手机号</th><th>加入时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="s in course.students" :key="s.id">
              <td>{{ s.name }}</td>
              <td>{{ s.username }}</td>
              <td>{{ s.phone || '-' }}</td>
              <td>{{ fmtTime(s.course_students?.joined_at) }}</td>
              <td><button class="link danger" @click="remove(s)">移出</button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">暂无学生加入，分享课堂码/二维码给学生</p>
      </section>
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
.course-head { margin-bottom: 16px; }
.course-head h2 { font-size: 22px; margin: 0 0 6px; }
.credit {
  display: inline-block; font-size: 13px; font-weight: 500; color: #047857;
  background: #ecfdf5; border-radius: 6px; padding: 3px 10px; margin-left: 8px; vertical-align: middle;
}
.tip { color: #6b7280; font-size: 14px; margin: 0; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.card h3 { margin: 0 0 14px; font-size: 16px; }
.primary {
  padding: 9px 18px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; }
.weight-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.weight-form { display: flex; gap: 12px; flex-wrap: wrap; }
.weight-form label { font-size: 13px; color: #374151; display: flex; flex-direction: column; gap: 4px; }
.weight-form input {
  width: 90px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; outline: none;
}
.entry-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.entry {
  position: relative;
  display: flex; align-items: center; gap: 12px; background: #f8fafc;
  border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; text-decoration: none; color: inherit;
  transition: all 0.15s;
}
.badge {
  position: absolute; top: -6px; right: -6px;
  background: #dc2626; color: #fff; font-size: 12px; font-weight: 600;
  min-width: 20px; height: 20px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; padding: 0 5px;
}
.entry:hover { border-color: #2563eb; background: #eff6ff; }
.entry.hot { border-color: #bfdbfe; background: #eff6ff; }
.e-icon { font-size: 24px; }
.e-text b { font-size: 14px; color: #1e293b; }
.e-text p { margin: 3px 0 0; font-size: 12px; color: #64748b; }
.e-arrow { margin-left: auto; color: #94a3b8; font-size: 18px; }
.code-card .code-box { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.code-box { text-align: center; }
.code {
  font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #1d4ed8;
  font-family: monospace; margin: 0;
}
.qr { width: 180px; height: 180px; border: 1px solid #e5e7eb; border-radius: 8px; }
.list-card table { width: 100%; border-collapse: collapse; }
th, td { padding: 9px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
th { background: #f8fafc; font-weight: 600; }
.empty { color: #9ca3af; text-align: center; padding: 20px 0; }
.link { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 13px; padding: 2px 6px; }
.link.danger { color: #dc2626; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
