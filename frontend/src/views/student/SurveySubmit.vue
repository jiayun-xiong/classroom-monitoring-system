<script setup>
const router = useRouter()
// 学生端-学情调查：查看课程调查列表（知识点/截止/我的反馈）→ 反馈（6 档评分或自定义选项）
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getCourses } from '../../api/course'
import { getSurveys, getSurvey, respondSurvey } from '../../api/survey'

const route = useRoute()
const courses = ref([])
const currentCourse = ref(null)
const surveys = ref([])
const selected = ref(null)
const detail = ref(null)
const message = ref('')
const submitting = ref(false)
const chosenScore = ref(null)
const chosenAnswer = ref('')

const EMOJI = ['😵', '😕', '😐', '🙂', '😊', '🤩']
const EMOJI_LABEL = ['完全没理解', '基本没理解', '有点模糊', '基本掌握', '掌握不错', '完全理解']

let pollTimer = null

onMounted(() => {
  loadCourses()
  // 实时感知教师端新发布的调查（不打断正在查看/填写的详情）
  pollTimer = setInterval(() => {
    if (currentCourse.value) loadList(currentCourse.value, false)
  }, 1000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

function fmtTime(t) {
  if (!t) return '长期开放'
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
      await loadList(currentCourse.value)
    }
  } catch (e) {
    message.value = '加载失败：' + e.message
  }
}

async function loadList(courseId, resetView = true) {
  try {
    const res = await getSurveys(courseId)
    surveys.value = res.data.list
    if (resetView) {
      selected.value = null
      detail.value = null
    }
  } catch (e) {
    message.value = e.message
  }
}

function switchCourse(c) {
  currentCourse.value = c.id
  loadList(c.id)
}

async function openDetail(s) {
  selected.value = s
  detail.value = null
  chosenScore.value = null
  chosenAnswer.value = ''
  try {
    const res = await getSurvey(s.id)
    detail.value = res.data
    if (detail.value.myResponse) {
      chosenScore.value = detail.value.myResponse.score
      chosenAnswer.value = detail.value.myResponse.answer || ''
    }
  } catch (e) {
    message.value = e.message
  }
}

async function doRespond() {
  if (submitting.value) return
  if (!selected.value || !detail.value) return
  if (detail.value.survey.useEmotion && !chosenScore.value) {
    message.value = '请选择理解程度'
    return
  }
  if (!detail.value.survey.useEmotion && !chosenAnswer.value) {
    message.value = '请选择一个选项'
    return
  }
  submitting.value = true
  try {
    const body = detail.value.survey.useEmotion
      ? { score: Number(chosenScore.value) }
      : { answer: chosenAnswer.value }
    const res = await respondSurvey(selected.value.id, body)
    message.value = res.message
    await openDetail(selected.value)
    await loadList(currentCourse.value)
  } catch (e) {
    message.value = e.message
  } finally {
    submitting.value = false
  }
}
import DanmakuPanel from '../../components/DanmakuPanel.vue'
import { useRouter } from 'vue-router'

function goBack() { if (window.history.length > 1) router.back(); else router.push('/student') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">学生端</span></div>
      
    </header>
    <main>
      <h2>学情调查</h2>
      <p class="tip">教师每讲完一个知识点发起调查，选择最能代表你理解程度的选项（可修改，取最新反馈）</p>
      <p v-if="message" class="msg">{{ message }}</p>


      <div class="cols">
        <div class="col list-col">
          <div v-if="surveys.length === 0" class="empty">该课程暂无学情调查</div>
          <div
            v-for="s in surveys"
            :key="s.id"
            class="s-card"
            :class="{ active: selected?.id === s.id }"
            @click="openDetail(s)"
          >
            <div class="s-title">{{ s.knowledgePoint }}</div>
            <div class="s-meta">
              {{ s.useEmotion ? '6 档评分' : '自定义选项' }} · {{ fmtTime(s.deadline) }}
              <span class="tag" :class="s.isClosed ? 't-end' : 't-live'">{{ s.isClosed ? '已结束' : '收集中' }}</span>
            </div>
            <div class="s-mine">
              <span v-if="s.myResponse" class="mine">已反馈：{{ s.myResponse.score != null ? s.myResponse.score + ' 分' : s.myResponse.answer }}</span>
              <span v-else class="tag t-none">未反馈</span>
            </div>
          </div>
        </div>

        <div class="col detail-col">
          <template v-if="selected && detail">
            <h3>{{ detail.survey.knowledgePoint }}</h3>
            <p class="meta">
              {{ detail.survey.useEmotion ? '6 档理解评分（1=完全没理解，6=完全理解）' : '请选择最符合的选项' }} · 截止 {{ fmtTime(detail.survey.deadline) }}
            </p>

            <div v-if="detail.survey.isClosed" class="notice">本次调查已结束</div>
            <div v-else class="respond-box">
              <!-- 6 档 -->
              <template v-if="detail.survey.useEmotion">
                <div class="emoji-grid">
                  <button
                    v-for="(e, i) in EMOJI"
                    :key="i"
                    class="emoji-btn"
                    :class="{ chosen: chosenScore === i + 1 }"
                    :disabled="submitting"
                    @click="chosenScore = i + 1"
                  >
                    <div class="e-big">{{ e }}</div>
                    <div class="e-label">{{ i + 1 }} 分 · {{ EMOJI_LABEL[i] }}</div>
                  </button>
                </div>
              </template>
              <!-- 自定义 -->
              <template v-else>
                <div class="opt-grid">
                  <button
                    v-for="o in detail.survey.options"
                    :key="o"
                    class="opt-btn"
                    :class="{ chosen: chosenAnswer === o }"
                    :disabled="submitting"
                    @click="chosenAnswer = o"
                  >
                    {{ o }}
                  </button>
                </div>
              </template>
              <div class="actions">
                <button class="primary" :disabled="submitting" @click="doRespond">
                  {{ submitting ? '提交中...' : detail.myResponse ? '更新反馈' : '提交反馈' }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
      <DanmakuPanel v-if="currentCourse" :course-id="currentCourse" source="survey" :ref-id="selected ? selected.id : null" label="课堂讨论 · 学情调查" class="dm-panel" />
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
.cols { display: grid; grid-template-columns: 340px 1fr; gap: 16px; align-items: start; }
.list-col { max-height: 72vh; overflow-y: auto; }
.s-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s;
}
.s-card:hover { border-color: #93c5fd; }
.s-card.active { border-color: #2563eb; background: #eff6ff; }
.s-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.s-meta { font-size: 12px; color: #6b7280; margin: 6px 0; }
.s-mine { font-size: 12px; }
.mine { color: #1d4ed8; font-weight: 500; }
.tag { display: inline-block; font-size: 11px; padding: 2px 10px; border-radius: 20px; font-weight: 500; }
.t-live { background: #dcfce7; color: #15803d; }
.t-end { background: #f3f4f6; color: #6b7280; }
.t-none { background: #f3f4f6; color: #6b7280; }
.detail-col { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; min-height: 300px; }
.detail-col h3 { margin: 0 0 6px; font-size: 18px; }
.meta { color: #6b7280; font-size: 12px; margin: 0 0 14px; }
.notice { background: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 14px; color: #92400e; font-size: 13px; margin: 12px 0; }
.respond-box { display: grid; gap: 14px; }
.emoji-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.emoji-btn {
  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 6px; cursor: pointer; transition: all 0.15s;
}
.emoji-btn:hover { border-color: #2563eb; }
.emoji-btn.chosen { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); }
.emoji-btn:disabled { opacity: 0.6; }
.e-big { font-size: 32px; }
.e-label { font-size: 11px; color: #6b7280; margin-top: 6px; }
.opt-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.opt-btn {
  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 16px; font-size: 14px; cursor: pointer; transition: all 0.15s;
}
.opt-btn:hover { border-color: #2563eb; }
.opt-btn.chosen { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); }
.actions { display: flex; }
.primary {
  padding: 10px 22px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; cursor: not-allowed; }
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
  .cols { grid-template-columns: 1fr; }
  .list-col { max-height: none; }
  .emoji-grid { grid-template-columns: repeat(3, 1fr); }
  .opt-grid { grid-template-columns: 1fr; }
  .course-bar { overflow-x: auto; }
}
</style>
