<script setup>
const router = useRouter()
// 教师端-学情调查：每讲完一个知识点发起调查（6 档评分或自定义选项）→ 实时统计（分布/参与名单）
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { createSurvey, getSurveys, getSurvey, getSurveyStats, closeSurvey, deleteSurvey } from '../../api/survey'
import { useRouter } from 'vue-router'

const route = useRoute()
const courseId = route.params.id

const surveys = ref([])
const selected = ref(null)
const stats = ref(null)
const message = ref('')

const showForm = ref(false)
const form = ref({ knowledgePoint: '', useEmotion: true, optionsText: '', deadline: '' })

const EMOJI = ['😵', '😕', '😐', '🙂', '😊', '🤩']
const EMOJI_LABEL = ['完全没理解', '基本没理解', '有点模糊', '基本掌握', '掌握不错', '完全理解']

let pollTimer = null

onMounted(() => {
  loadList()
  // 实时感知学生提交的反馈
  pollTimer = setInterval(loadList, 1000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

function fmtTime(t) {
  if (!t) return '长期开放'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function loadList() {
  try {
    const res = await getSurveys(courseId)
    surveys.value = res.data.list
  } catch (e) {
    message.value = '加载失败：' + e.message
  }
}

async function selectSurvey(s) {
  selected.value = s
  stats.value = null
  try {
    const res = await getSurveyStats(s.id)
    stats.value = res.data
  } catch (e) {
    message.value = e.message
  }
}

async function saveSurvey() {
  if (!form.value.knowledgePoint.trim()) {
    message.value = '请填写调查的知识点'
    return
  }
  const data = {
    knowledgePoint: form.value.knowledgePoint.trim(),
    useEmotion: form.value.useEmotion,
    deadline: form.value.deadline || null,
  }
  if (!form.value.useEmotion) {
    const opts = form.value.optionsText
      .split(/[，,\n]/)
      .map((o) => o.trim())
      .filter(Boolean)
    if (opts.length < 2) {
      message.value = '自定义选项至少 2 个，用逗号分隔'
      return
    }
    data.options = opts
  }
  try {
    const res = await createSurvey(courseId, data)
    message.value = res.message
    showForm.value = false
    form.value = { knowledgePoint: '', useEmotion: true, optionsText: '', deadline: '' }
    await loadList()
  } catch (e) {
    message.value = e.message
  }
}

async function doClose() {
  if (!selected.value) return
  if (!confirm(`确定关闭「${selected.value.knowledgePoint}」调查？学生将无法继续反馈。`)) return
  try {
    const res = await closeSurvey(selected.value.id)
    message.value = res.message
    await loadList()
    await selectSurvey(selected.value)
  } catch (e) {
    message.value = e.message
  }
}

async function removeSurvey() {
  if (!selected.value) return
  if (!confirm(`确定删除「${selected.value.knowledgePoint}」调查？其下反馈将一并删除。`)) return
  try {
    const res = await deleteSurvey(selected.value.id)
    message.value = res.message
    selected.value = null
    stats.value = null
    await loadList()
  } catch (e) {
    message.value = e.message
  }
}

// ===== 名单弹窗：统计卡/分布格点击查看学生名单 =====
const showModal = ref(false)
const modalTitle = ref('')
const modalList = ref([])

function openStudents(type, payload) {
  if (!stats.value) return
  const s = stats.value
  if (type === 'total') {
    modalTitle.value = `课堂总人数（${s.totalStudents}）`
    modalList.value = [
      ...s.respondedStudents.map((u) => ({
        name: u.name,
        username: u.username,
        info: u.response?.score != null ? u.response.score + ' 分' : u.response?.answer || '已反馈',
      })),
      ...s.unrespondedStudents.map((u) => ({ name: u.name, username: u.username, info: '未反馈' })),
    ]
  } else if (type === 'responded') {
    modalTitle.value = `已反馈（${s.respondedCount}）`
    modalList.value = s.respondedStudents.map((u) => ({
      name: u.name,
      username: u.username,
      info: u.response?.score != null ? u.response.score + ' 分' : u.response?.answer || '',
    }))
  } else if (type === 'unresponded') {
    modalTitle.value = `未反馈（${s.unrespondedCount}）`
    modalList.value = s.unrespondedStudents.map((u) => ({ name: u.name, username: u.username, info: '未反馈' }))
  } else if (type === 'score') {
    const score = payload + 1
    const arr = s.respondedStudents.filter((u) => u.response?.score === score)
    modalTitle.value = `${score} 分 · ${EMOJI_LABEL[payload]}（${arr.length} 人）`
    modalList.value = arr.map((u) => ({ name: u.name, username: u.username, info: score + ' 分' }))
  } else if (type === 'option') {
    const opt = payload
    const arr = s.respondedStudents.filter((u) => u.response?.answer === opt)
    modalTitle.value = `「${opt}」（${arr.length} 人）`
    modalList.value = arr.map((u) => ({ name: u.name, username: u.username, info: opt }))
  }
  showModal.value = true
}

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/teacher/courses/${courseId}`) }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      
    </header>
    <main>
      <h2>学情调查</h2>
      <p class="tip">每讲完一个知识点发起调查：选择反馈形式（6 档理解评分 / 自定义选项）→ 学生实时反馈 → 即时统计</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <button class="primary" @click="showForm = !showForm">{{ showForm ? '收起表单' : '📋 发起学情调查' }}</button>

      <div v-if="showForm" class="form-card">
        <label>调查知识点 *<input v-model="form.knowledgePoint" class="input" placeholder="如：第三章 需求分析" /></label>
        <label>反馈形式
          <select v-model="form.useEmotion" class="input">
            <option :value="true">6 档理解评分（1-6）</option>
            <option :value="false">自定义选项</option>
          </select>
        </label>
        <label v-if="!form.useEmotion">自定义选项（至少 2 个，逗号分隔）<input v-model="form.optionsText" class="input" placeholder="如：完全掌握，基本掌握，有点模糊，没听懂" /></label>
        <label>截止时间（可选，留空=长期开放）<input v-model="form.deadline" class="input" type="datetime-local" /></label>
        <div class="actions">
          <button class="primary" @click="saveSurvey">发起调查</button>
          <button class="ghost" @click="showForm = false">取消</button>
        </div>
      </div>

      <div class="cols">
        <!-- 左：调查列表 -->
        <div class="col list-col">
          <div v-if="surveys.length === 0" class="empty">还没有学情调查</div>
          <div
            v-for="s in surveys"
            :key="s.id"
            class="s-card"
            :class="{ active: selected?.id === s.id }"
            @click="selectSurvey(s)"
          >
            <div class="s-title">{{ s.knowledgePoint }}</div>
            <div class="s-meta">
              {{ s.useEmotion ? '6 档评分' : '自定义选项' }} · {{ fmtTime(s.deadline) }}
              <span class="tag" :class="s.isClosed ? 't-end' : 't-live'">{{ s.isClosed ? '已结束' : '收集中' }}</span>
            </div>
            <div v-if="s.stats" class="s-stats">已反馈 {{ s.stats.participantCount }} 人<span v-if="s.stats.avgScore != null"> · 平均 {{ s.stats.avgScore }}</span></div>
          </div>
        </div>

        <!-- 右：统计 -->
        <div class="col detail-col">
          <template v-if="selected && stats">
            <div class="detail-head">
              <div>
                <h3>{{ stats.survey.knowledgePoint }}</h3>
                <p class="meta">{{ stats.survey.useEmotion ? '6 档理解评分' : '自定义选项' }} · {{ fmtTime(stats.survey.deadline) }}</p>
              </div>
              <div class="head-actions">
                <button v-if="!stats.survey.status || stats.survey.status === 'open'" class="danger" @click="doClose">⏹ 停止反馈</button>
                <button class="ghost" @click="removeSurvey">删除</button>
              </div>
            </div>

            <div class="stat-cards">
              <div class="stat clickable" @click="openStudents('total')"><b>{{ stats.totalStudents }}</b><span>课堂总人数</span></div>
              <div class="stat clickable" @click="openStudents('responded')"><b>{{ stats.respondedCount }}</b><span>已反馈</span></div>
              <div class="stat clickable" @click="openStudents('unresponded')"><b>{{ stats.unrespondedCount }}</b><span>未反馈</span></div>
              <div class="stat"><b>{{ stats.avgScore ?? '-' }}</b><span>平均分</span></div>
            </div>

            <!-- 6 档分布 -->
            <template v-if="stats.survey.useEmotion">
              <div class="emoji-row">
                <div v-for="(e, i) in EMOJI" :key="i" class="emoji-cell clickable" @click="openStudents('score', i)">
                  <div class="emoji-big">{{ e }}</div>
                  <div class="emoji-score">{{ i + 1 }} 分 · {{ EMOJI_LABEL[i] }}</div>
                  <div class="emoji-count">{{ (stats.distribution || [])[i] || 0 }} 人</div>
                </div>
              </div>
            </template>
            <!-- 自定义选项分布 -->
            <template v-else>
              <div class="option-row">
                <div v-for="(o, i) in stats.optionCounts" :key="i" class="option-cell clickable" @click="openStudents('option', o.option)">
                  <div class="opt-name">{{ o.option }}</div>
                  <div class="opt-count">{{ o.count }} 人</div>
                </div>
              </div>
            </template>

          </template>
          <div v-else class="empty">选择左侧调查查看实时统计</div>
        </div>
      </div>

      <!-- 名单弹窗 -->
      <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-head">
            <b>{{ modalTitle }}</b>
            <button class="modal-close" @click="showModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div v-for="u in modalList" :key="u.username" class="modal-item">
              {{ u.name }}（{{ u.username }}）<span class="dim">{{ u.info }}</span>
            </div>
            <div v-if="modalList.length === 0" class="dim">暂无学生</div>
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
main { max-width: 1120px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.primary {
  padding: 9px 18px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.ghost {
  padding: 8px 14px; background: #fff; color: #374151; border: 1px solid #d1d5db;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.danger {
  padding: 8px 14px; background: #fff; color: #dc2626; border: 1px solid #fca5a5;
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
.s-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s;
}
.s-card:hover { border-color: #93c5fd; }
.s-card.active { border-color: #2563eb; background: #eff6ff; }
.s-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.s-meta { font-size: 12px; color: #6b7280; margin: 6px 0; }
.s-stats { font-size: 12px; color: #6b7280; }
.tag { display: inline-block; font-size: 11px; padding: 2px 10px; border-radius: 20px; font-weight: 500; margin-left: 4px; }
.t-live { background: #dcfce7; color: #15803d; }
.t-end { background: #f3f4f6; color: #6b7280; }
.detail-col { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; min-height: 300px; }
.detail-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.detail-head h3 { margin: 0 0 6px; font-size: 18px; }
.meta { color: #6b7280; font-size: 12px; margin: 0; }
.head-actions { display: flex; gap: 8px; align-items: flex-start; }
.stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 10px; text-align: center; }
.stat b { font-size: 24px; display: block; color: #1e293b; }
.stat span { font-size: 11px; color: #6b7280; }
.emoji-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 18px; }
.emoji-cell {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 12px 6px; text-align: center;
}
.emoji-big { font-size: 30px; }
.emoji-score { font-size: 11px; color: #6b7280; margin: 6px 0 4px; }
.emoji-count { font-size: 15px; font-weight: 600; color: #1d4ed8; }
.option-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
.option-cell {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 10px; text-align: center;
}
.opt-name { font-size: 13px; font-weight: 600; color: #1e293b; }
.opt-count { font-size: 15px; font-weight: 600; color: #1d4ed8; margin-top: 6px; }
.clickable { cursor: pointer; transition: all 0.15s; }
.clickable:hover { border-color: #2563eb; background: #eff6ff; }
.modal-mask {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: #fff; border-radius: 14px; width: 420px; max-width: 90vw;
  max-height: 70vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid #e5e7eb; font-size: 15px;
}
.modal-close {
  background: none; border: none; font-size: 15px; cursor: pointer; color: #6b7280;
}
.modal-body { padding: 10px 18px 16px; overflow-y: auto; }
.modal-item {
  font-size: 13px; color: #374151; padding: 8px 0;
  border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; gap: 10px;
}
.modal-item:last-child { border-bottom: none; }
.dim { color: #9ca3af; font-size: 12px; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
