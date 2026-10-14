<script setup>
const router = useRouter()
const route = useRoute()
// 学生端-期末考试与总成绩：考试列表（线上作答/我的成绩）→ 我的加权总成绩与排名
import { onMounted, onUnmounted, ref } from 'vue'
import { getCourses } from '../../api/course'
import { getExams, submitExamScore, getFinalScores } from '../../api/exam'
import { useRoute, useRouter } from 'vue-router'

const courses = ref([])
const currentCourse = ref(null)
const exams = ref([])
const finalData = ref(null)
const message = ref('')
const submitting = ref(false)

// 线上作答输入（按考试 id 存）
const onlineInputs = ref({})

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function loadCourses() {
  try {
    const res = await getCourses()
    courses.value = res.data.list
    if (courses.value.length) {
      const q = Number(route.query.courseId)
      const target = q ? courses.value.find((x) => Number(x.id) === q) : null
      currentCourse.value = target ? target.id : courses.value[0].id
      await loadAll(currentCourse.value)
    }
  } catch (e) {
    message.value = '加载失败：' + e.message
  }
}

async function loadAll(courseId) {
  try {
    const [eRes, fRes] = await Promise.all([getExams(courseId), getFinalScores(courseId)])
    exams.value = eRes.data.list
    finalData.value = fRes.data
  } catch (e) {
    message.value = e.message
  }
}

function switchCourse(c) {
  currentCourse.value = c.id
  loadAll(c.id)
}

function canSubmit(e) {
  return (
    e.form === 'online' &&
    !e.myScore?.confirmed &&
    new Date(e.examTime).getTime() > Date.now()
  )
}

async function doSubmit(e) {
  if (submitting.value) return
  const val = onlineInputs.value[e.id]
  if (val === undefined || val === null || val === '') {
    message.value = '请填写成绩'
    return
  }
  submitting.value = true
  try {
    const res = await submitExamScore(e.id, Number(val))
    message.value = res.message
    await loadAll(currentCourse.value)
  } catch (err) {
    message.value = err.message
  } finally {
    submitting.value = false
  }
}

let pollTimer = null

onMounted(() => {
  loadCourses()
  // 实时感知教师端发布的考试
  pollTimer = setInterval(() => {
    if (currentCourse.value) loadAll(currentCourse.value)
  }, 1000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

function goBack() { if (window.history.length > 1) router.back(); else router.push('/student') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">学生端</span></div>
      
    </header>
    <main>
      <h2>期末考试与总成绩</h2>
      <p class="tip">查看期末考试（线上作答需在考试时间前提交，由教师确认）与加权总成绩、排名</p>
      <p v-if="message" class="msg">{{ message }}</p>


      <!-- 我的总成绩 -->
      <div v-if="finalData" class="my-card">
        <h3>我的总成绩
          <span v-if="finalData.me && finalData.me.rank != null" class="rank-tag">第 {{ finalData.me.rank }} 名</span>
        </h3>
        <p class="meta">权重：签到 {{ finalData.weights.checkinWeight }}% · 作业 {{ finalData.weights.homeworkWeight }}% · 期末 {{ finalData.weights.examWeight }}%</p>
        <template v-if="finalData.me">
          <div class="my-stats">
            <div class="my-stat"><b>{{ finalData.me.checkinScore }}</b><span>签到</span></div>
            <div class="my-stat"><b>{{ finalData.me.homeworkScore }}</b><span>作业</span></div>
            <div class="my-stat"><b>{{ finalData.me.examScore ?? '-' }}</b><span>期末</span></div>
            <div class="my-stat main"><b>{{ finalData.me.final ?? '-' }}</b><span>总成绩</span></div>
          </div>
        </template>
        <p v-else class="dim">暂无总成绩（等待期末成绩录入）</p>
      </div>

      <!-- 考试列表 -->
      <div class="exam-list">
        <div v-if="exams.length === 0" class="empty">该课程暂无期末考试</div>
        <div v-for="e in exams" :key="e.id" class="exam-card">
          <div class="exam-main">
            <div class="e-title">{{ e.name }}</div>
            <div class="e-meta">{{ fmtTime(e.examTime) }} · {{ e.form === 'online' ? '线上作答' : '线下录入' }} · 满分 {{ e.fullScore }}</div>
            <div class="e-score">
              <template v-if="e.myScore">
                <span class="tag" :class="e.myScore.confirmed ? 't-done' : 't-wait'">
                  {{ e.myScore.confirmed ? '已确认 ' + e.myScore.score + ' 分' : '已提交 ' + e.myScore.score + ' 分（待确认）' }}
                </span>
              </template>
              <span v-else class="tag t-none">未作答</span>
            </div>
          </div>
          <div v-if="canSubmit(e)" class="exam-act">
            <input
              v-model.number="onlineInputs[e.id]"
              class="input"
              type="number"
              :min="0"
              :max="e.fullScore"
              step="0.5"
              placeholder="我的成绩"
            />
            <button class="primary" :disabled="submitting" @click="doSubmit(e)">提交作答</button>
          </div>
          <div v-else-if="e.form === 'online' && !e.myScore" class="exam-act">
            <span class="dim" v-if="new Date(e.examTime).getTime() <= Date.now()">考试时间已过</span>
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
.back a { color: #2563eb; font-size: 14px; text-decoration: none; }
main { max-width: 900px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.course-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.sec-label { font-size: 13px; color: #6b7280; }
.chip {
  padding: 6px 14px; border: 1px solid #d1d5db; background: #fff; border-radius: 20px;
  font-size: 13px; cursor: pointer;
}
.chip.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.my-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; margin-bottom: 16px; }
.my-card h3 { margin: 0 0 6px; font-size: 17px; display: flex; align-items: center; gap: 10px; }
.meta { color: #6b7280; font-size: 12px; margin: 0 0 14px; }
.rank-tag {
  background: #2563eb; color: #fff; font-size: 12px; padding: 3px 12px; border-radius: 20px; font-weight: 500;
}
.my-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.my-stat { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 10px; text-align: center; }
.my-stat.main { background: #eff6ff; border-color: #bfdbfe; }
.my-stat b { font-size: 22px; display: block; color: #1e293b; }
.my-stat span { font-size: 11px; color: #6b7280; }
.exam-list { display: grid; gap: 10px; }
.exam-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; gap: 16px;
}
.e-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.e-meta { font-size: 12px; color: #6b7280; margin: 6px 0; }
.e-score { font-size: 12px; }
.tag { display: inline-block; font-size: 12px; padding: 3px 12px; border-radius: 20px; font-weight: 500; }
.t-done { background: #dcfce7; color: #15803d; }
.t-wait { background: #fef3c7; color: #92400e; }
.t-none { background: #f3f4f6; color: #6b7280; }
.exam-act { display: flex; gap: 8px; align-items: center; }
.input {
  width: 130px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; font-family: inherit;
}
.primary {
  padding: 9px 18px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.dim { color: #9ca3af; font-size: 12px; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }
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
  .course-bar { overflow-x: auto; }
  .my-stats { grid-template-columns: 1fr 1fr; }
}
</style>
