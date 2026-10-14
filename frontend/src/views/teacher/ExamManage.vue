<script setup>
const router = useRouter()
// 教师端-期末考试与总成绩：发布考试（线下录入/线上作答）→ 录入/确认成绩 → 加权总成绩榜
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { createExam, getExams, getExamScores, saveExamScores, getFinalScores } from '../../api/exam'
import { useRouter } from 'vue-router'

const route = useRoute()
const courseId = route.params.id

const exams = ref([])
const selected = ref(null)
const examDetail = ref(null)
const finalData = ref(null)
const message = ref('')

const showForm = ref(false)
const form = ref({ name: '', examTime: '', fullScore: 100, form: 'offline' })
const saving = ref(false)
const tab = ref('exam')

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function loadList() {
  try {
    const res = await getExams(courseId)
    exams.value = res.data.list
  } catch (e) {
    message.value = '加载失败：' + e.message
  }
}

async function loadFinal() {
  try {
    const res = await getFinalScores(courseId)
    finalData.value = res.data
  } catch (e) {
    message.value = e.message
  }
}

async function selectExam(e) {
  selected.value = e
  examDetail.value = null
  try {
    const res = await getExamScores(e.id)
    examDetail.value = res.data
    // 未录入的初始为空字符串
    examDetail.value.rows.forEach((r) => {
      r.input = r.score == null ? '' : String(r.score)
    })
  } catch (err) {
    message.value = err.message
  }
}

async function saveExam() {
  if (!form.value.name.trim()) {
    message.value = '请填写考试名称'
    return
  }
  if (!form.value.examTime) {
    message.value = '请选择考试时间'
    return
  }
  if (!form.value.fullScore || Number(form.value.fullScore) <= 0) {
    message.value = '满分必须大于 0'
    return
  }
  try {
    const res = await createExam(courseId, {
      name: form.value.name.trim(),
      examTime: new Date(form.value.examTime).toISOString(),
      fullScore: Number(form.value.fullScore),
      form: form.value.form,
    })
    message.value = res.message
    showForm.value = false
    form.value = { name: '', examTime: '', fullScore: 100, form: 'offline' }
    await loadList()
  } catch (e) {
    message.value = e.message
  }
}

async function saveAllScores() {
  if (!examDetail.value) return
  saving.value = true
  try {
    const scores = examDetail.value.rows
      .filter((r) => r.input !== '' && r.input != null)
      .map((r) => ({ studentId: r.student_id, score: Number(r.input) }))
    if (!scores.length) {
      message.value = '请先输入成绩'
      return
    }
    const res = await saveExamScores(selected.value.id, scores)
    message.value = res.message
    await selectExam(selected.value)
    await loadList()
  } catch (e) {
    message.value = e.message
  } finally {
    saving.value = false
  }
}

function rowSourceText(r) {
  if (r.score == null) return '未录入'
  return r.source === 'student' ? '学生提交' : '已确认'
}

onMounted(() => {
  loadList()
  loadFinal()
})

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/teacher/courses/${courseId}`) }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      
    </header>
    <main>
      <h2>期末考试与总成绩</h2>
      <p class="tip">发布期末考试（线下录入 / 线上作答）→ 录入成绩 → 按权重自动加权计算总成绩</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <button class="primary" @click="showForm = !showForm">{{ showForm ? '收起表单' : '📝 发布期末考试' }}</button>

      <div v-if="showForm" class="form-card">
        <label>考试名称 *<input v-model="form.name" class="input" placeholder="如：2026 秋季学期期末考试" /></label>
        <label>考试时间 *<input v-model="form.examTime" class="input" type="datetime-local" /></label>
        <label>满分 *<input v-model.number="form.fullScore" class="input" type="number" min="1" /></label>
        <label>考试形式
          <select v-model="form.form" class="input">
            <option value="offline">线下成绩录入</option>
            <option value="online">线上作答（学生提交，教师确认）</option>
          </select>
        </label>
        <div class="actions">
          <button class="primary" @click="saveExam">发布考试</button>
          <button class="ghost" @click="showForm = false">取消</button>
        </div>
      </div>

      <div class="cols">
        <!-- 左：考试列表 -->
        <div class="col list-col">
          <div v-if="exams.length === 0" class="empty">还没有期末考试</div>
          <div
            v-for="e in exams"
            :key="e.id"
            class="e-card"
            :class="{ active: selected?.id === e.id }"
            @click="selectExam(e)"
          >
            <div class="e-title">{{ e.name }}</div>
            <div class="e-meta">
              {{ fmtTime(e.examTime) }} · {{ e.form === 'online' ? '线上作答' : '线下录入' }} · 满分 {{ e.fullScore }}
            </div>
            <div class="e-stats">已录 {{ e.scoredCount }} 人</div>
          </div>
        </div>

        <!-- 右：详情 + 总成绩 -->
        <div class="col detail-col">
          <div class="tabs">
            <button class="tab" :class="{ on: !finalData || tab === 'exam' }" @click="tab = 'exam'">成绩录入</button>
            <button class="tab" :class="{ on: tab === 'final' }" @click="tab = 'final'">总成绩榜</button>
          </div>

          <!-- 成绩录入 -->
          <template v-if="tab === 'exam'">
            <template v-if="selected && examDetail">
              <div class="detail-head">
                <div>
                  <h3>{{ examDetail.exam.name }}</h3>
                  <p class="meta">{{ fmtTime(examDetail.exam.examTime) }} · {{ examDetail.exam.form === 'online' ? '线上作答（学生提交后在此确认）' : '线下录入' }} · 满分 {{ examDetail.exam.fullScore }}</p>
                </div>
                <div class="head-actions">
                  <button class="primary" :disabled="saving" @click="saveAllScores">{{ saving ? '保存中...' : '保存成绩' }}</button>
                </div>
              </div>
              <div class="score-table">
                <div class="score-head"><span>学生</span><span>成绩</span><span>状态</span></div>
                <div v-for="r in examDetail.rows" :key="r.student_id" class="score-row">
                  <span class="s-name">{{ r.name }}（{{ r.username }}）</span>
                  <input
                    v-model="r.input"
                    class="score-input"
                    type="number"
                    :min="0"
                    :max="examDetail.exam.fullScore"
                    step="0.5"
                  />
                  <span class="s-status" :class="{ warn: r.source === 'student' }">{{ rowSourceText(r) }}</span>
                </div>
                <div v-if="examDetail.rows.length === 0" class="empty">该课程暂无学生</div>
              </div>
            </template>
            <div v-else class="empty">选择左侧考试进行成绩录入</div>
          </template>

          <!-- 总成绩榜 -->
          <template v-else-if="finalData">
            <div class="final-head">
              <h3>加权总成绩（签到 {{ finalData.weights.checkinWeight }}% + 作业 {{ finalData.weights.homeworkWeight }}% + 期末 {{ finalData.weights.examWeight }}%）</h3>
              <p class="meta">应到会话 {{ finalData.sessionCount }} 次 · 非豁免作业 {{ finalData.homeworkCount }} 次 · 考试 {{ finalData.examCount }} 门（期末按满分折算百分制）</p>
            </div>
            <div class="final-table">
              <div class="f-head">
                <span>排名</span><span>学生</span><span>签到</span><span>作业</span><span>期末</span><span>总成绩</span>
              </div>
              <div v-for="row in finalData.list" :key="row.student_id" class="f-row">
                <span class="rank">{{ row.rank ?? '-' }}</span>
                <span class="f-name">{{ row.name }}（{{ row.username }}）</span>
                <span>{{ row.checkinScore }}</span>
                <span>{{ row.homeworkScore }}</span>
                <span>{{ row.examScore ?? '-' }}</span>
                <span class="f-final">{{ row.final ?? '-' }}</span>
              </div>
              <div v-if="finalData.list.length === 0" class="empty">该课程暂无学生</div>
            </div>
          </template>
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
main { max-width: 1120px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.primary {
  padding: 9px 18px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.ghost {
  padding: 8px 14px; background: #fff; color: #374151; border: 1px solid #d1d5db;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.form-card {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;
  padding: 16px 18px; margin: 14px 0; display: grid; gap: 12px;
}
.form-card label { display: grid; gap: 6px; font-size: 13px; color: #374151; }
.input {
  padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; background: #fff; font-family: inherit;
}
.actions { display: flex; gap: 10px; }
.cols { display: grid; grid-template-columns: 340px 1fr; gap: 16px; margin-top: 16px; align-items: start; }
.list-col { max-height: 72vh; overflow-y: auto; }
.e-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s;
}
.e-card:hover { border-color: #93c5fd; }
.e-card.active { border-color: #2563eb; background: #eff6ff; }
.e-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.e-meta { font-size: 12px; color: #6b7280; margin: 6px 0; }
.e-stats { font-size: 12px; color: #6b7280; }
.detail-col { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; min-height: 300px; }
.tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.tab {
  padding: 7px 16px; border: 1px solid #d1d5db; background: #fff; border-radius: 20px;
  font-size: 13px; cursor: pointer; color: #6b7280;
}
.tab.on { background: #2563eb; color: #fff; border-color: #2563eb; }
.detail-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.detail-head h3 { margin: 0 0 6px; font-size: 17px; }
.meta { color: #6b7280; font-size: 12px; margin: 0; }
.head-actions { display: flex; gap: 8px; align-items: flex-start; }
.score-table { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.score-head, .score-row {
  display: grid; grid-template-columns: 1fr 120px 100px; gap: 10px; align-items: center;
  padding: 9px 14px; font-size: 13px;
}
.score-head { background: #f8fafc; color: #6b7280; font-weight: 600; }
.score-row { border-top: 1px solid #f1f5f9; }
.s-name { color: #374151; }
.score-input {
  width: 100%; padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; font-family: inherit;
}
.s-status { font-size: 12px; color: #6b7280; }
.s-status.warn { color: #b45309; }
.final-head { margin-bottom: 14px; }
.final-head h3 { margin: 0 0 6px; font-size: 17px; }
.final-table { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.f-head, .f-row {
  display: grid; grid-template-columns: 60px 1fr 80px 80px 80px 90px; gap: 10px; align-items: center;
  padding: 9px 14px; font-size: 13px;
}
.f-head { background: #f8fafc; color: #6b7280; font-weight: 600; }
.f-row { border-top: 1px solid #f1f5f9; }
.rank { color: #2563eb; font-weight: 600; }
.f-name { color: #374151; }
.f-final { font-weight: 700; color: #1e293b; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
