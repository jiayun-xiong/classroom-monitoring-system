<script setup>
const router = useRouter()
// 教师端-学情反馈：按需开启反馈轮次（选知识点+设时长）→ 实时统计
// 统计卡：课堂总人数 / 已提交 / 未提交-签到/补签（点击名单）/ 未提交-请假/缺勤（点击名单）/ 平均分 / 方差
// 表情分布：每个分值可点击查看该分值学生名单
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { getSessions } from '../../api/checkin'
import {
  openEmotionRound,
  closeEmotionRound,
  getRoundStats,
  snapshotRound,
  getRoundSnapshots,
} from '../../api/emotion'

const route = useRoute()
const courseId = route.params.id

const sessions = ref([])
const current = ref(null)
const rounds = ref([])
const selectedRound = ref(null)
const stats = ref(null)
const snapshots = ref([])
const message = ref('')
const loading = ref(false)

const kpInput = ref('')
const durationInput = ref(5)

// 名单弹窗
const modal = ref({ show: false, title: '', list: [] })

let barChart = null
let pieChart = null
let timer = null
let countdownTimer = null
const remaining = ref(0)

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function fetchSessions() {
  loading.value = true
  try {
    const res = await getSessions(courseId)
    sessions.value = res.data.sessions
    if (!current.value) {
      current.value = sessions.value.find((s) => s.status === 'ongoing') || sessions.value[0] || null
    }
    if (current.value) {
      await loadRounds(current.value.id)
    }
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

async function selectSession(s) {
  current.value = s
  selectedRound.value = null
  stats.value = null
  await loadRounds(s.id)
}

async function loadRounds(sessionId) {
  try {
    const res = await getSessions(courseId)
    const my = res.data.sessions.find((s) => s.id === Number(sessionId))
    const list = (my && my.emotionRounds) || []
    rounds.value = list
    const open = list.find((r) => r.status === 'open' && new Date(r.end_at).getTime() >= Date.now())
    const target = open || list[0] || null
    if (target) {
      selectedRound.value = target
      await loadStats(target.id)
      await loadSnapshots(target.id)
    } else {
      stats.value = null
      snapshots.value = []
    }
  } catch (e) {
    rounds.value = []
  }
}

async function loadStats(roundId) {
  try {
    const res = await getRoundStats(roundId)
    stats.value = res.data
    if (stats.value.round?.status === 'open') {
      remaining.value = Math.max(0, Math.floor((new Date(stats.value.round.end_at).getTime() - Date.now()) / 1000))
    }
    await nextTick()
    renderCharts()
  } catch (e) {
    message.value = e.message
  }
}

async function loadSnapshots(roundId) {
  try {
    const res = await getRoundSnapshots(roundId)
    snapshots.value = res.data.snapshots
  } catch (e) {
    // 忽略
  }
}

function renderCharts() {
  if (!stats.value) return
  const labels = stats.value.emoji.map((e, i) => `${e} ${stats.value.emojiLabel[i]}（${i + 1} 分）`)
  const dist = stats.value.distribution
  const barDom = document.getElementById('bar-chart')
  const pieDom = document.getElementById('pie-chart')
  if (!barDom || !pieDom) return

  barChart = barChart || echarts.init(barDom)
  barChart.setOption({
    title: { text: '表情分布（柱状图）', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: dist,
        barWidth: '50%',
        itemStyle: { color: '#2563eb', borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top' },
      },
    ],
  })

  pieChart = pieChart || echarts.init(pieDom)
  pieChart.setOption({
    title: { text: '表情占比（饼状图）', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: { orient: 'vertical', left: 'left', textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['55%', '52%'],
        data: dist
          .map((v, i) => ({ name: `${stats.value.emoji[i]} ${i + 1} 分`, value: v }))
          .filter((d) => d.value > 0),
        label: { formatter: '{b}\n{c} 人' },
      },
    ],
  })
}

async function startRound() {
  if (!current.value) return
  if (current.value.status !== 'ongoing') {
    message.value = '该课堂未在上课中，请先开始上课'
    return
  }
  const kp = kpInput.value.trim() || '课堂反馈'
  const dur = Number(durationInput.value) || 5
  try {
    const res = await openEmotionRound(current.value.id, kp, dur)
    message.value = res.message
    kpInput.value = ''
    durationInput.value = 5
    await loadRounds(current.value.id)
  } catch (e) {
    message.value = e.message
  }
}

async function endRound() {
  if (!selectedRound.value) return
  if (!confirm(`确定结束「${selectedRound.value.knowledge_point}」反馈？结束后学生无法继续提交。`)) return
  try {
    const res = await closeEmotionRound(selectedRound.value.id)
    message.value = res.message
    await loadRounds(selectedRound.value.session_id)
  } catch (e) {
    message.value = e.message
  }
}

async function selectRound(r) {
  selectedRound.value = r
  await loadStats(r.id)
  await loadSnapshots(r.id)
}

async function makeSnapshot() {
  if (!selectedRound.value) return
  try {
    const res = await snapshotRound(selectedRound.value.id)
    message.value = res.message
    await loadSnapshots(selectedRound.value.id)
  } catch (e) {
    message.value = e.message
  }
}

// 打开名单弹窗：mode 'two' 两列（名单 + 具体出勤信息），'one' 单列
function openModal(title, list, mode) {
  modal.value = { show: true, title, list: list || [], mode: mode || 'one' }
}

// 出勤类型文案
function statusText(st) {
  if (st === 'normal') return '签到'
  if (st === 'makeup') return '补签'
  if (st === 'leave') return '请假'
  if (st === 'absent') return '缺勤'
  return '-'
}

function closeModal() {
  modal.value.show = false
}

function fmtRemaining(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

onMounted(() => {
  fetchSessions()
  timer = setInterval(async () => {
    if (selectedRound.value?.status === 'open') {
      await loadStats(selectedRound.value.id)
    }
  }, 1000)
  countdownTimer = setInterval(() => {
    if (selectedRound.value?.status === 'open') {
      remaining.value = Math.max(0, remaining.value - 1)
    }
  }, 1000)
  window.addEventListener('resize', () => {
    barChart && barChart.resize()
    pieChart && pieChart.resize()
  })
})
onUnmounted(() => {
  clearInterval(timer)
  clearInterval(countdownTimer)
  barChart && barChart.dispose()
  pieChart && pieChart.dispose()
})

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/teacher/courses/${courseId}`) }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      
    </header>
    <main>
      <h2>学情反馈（表情）</h2>
      <p class="tip">按需开启反馈轮次：选择本次需反馈的知识点 + 设置反馈时长 → 学生实时提交 6 类表情</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <div class="session-bar">
        <span class="sec-label">选择课堂会话：</span>
        <button
          v-for="s in sessions"
          :key="s.id"
          class="chip"
          :class="{ active: current?.id === s.id, live: s.status === 'ongoing' }"
          @click="selectSession(s)"
        >
          {{ fmtTime(s.start_time) }} {{ s.status === 'ongoing' ? '● 进行中' : '' }}
        </button>
        <p v-if="sessions.length === 0" class="empty">该课程还没有上课记录</p>
      </div>

      <!-- 开启反馈 -->
      <div v-if="current?.status === 'ongoing'" class="open-card">
        <div class="open-form">
          <input v-model="kpInput" class="input" placeholder="本次需反馈的知识点（如：第五章 面向对象设计）" maxlength="50" />
          <input v-model.number="durationInput" class="input w-90" type="number" min="1" max="60" placeholder="时长（分钟）" />
          <button class="primary" @click="startRound">🟢 开启学情反馈</button>
        </div>
        <div class="open-tip">同一会话同时只有一个开放反馈；新开轮次会自动结束上一个</div>
      </div>

      <template v-if="selectedRound">
        <!-- 当前轮次卡片 -->
        <div class="round-card" :class="{ off: selectedRound.status === 'closed' }">
          <div class="round-head">
            <div>
              <b class="kp">「{{ selectedRound.knowledge_point }}」</b>
              <span class="tag" :class="selectedRound.status === 'open' ? 't-live' : 't-end'">
                {{ selectedRound.status === 'open' ? '● 反馈进行中' : '已结束' }}
              </span>
            </div>
            <div class="round-meta">
              {{ fmtTime(selectedRound.start_at) }} ~ {{ fmtTime(selectedRound.end_at) }}
              <span v-if="selectedRound.status === 'open'" class="countdown">剩余 {{ fmtRemaining(remaining) }}</span>
            </div>
          </div>
          <div v-if="selectedRound.status === 'open'" class="round-actions">
            <button class="danger" @click="endRound">⏹ 停止当前反馈</button>
          </div>
        </div>

        <!-- 历史轮次 -->
        <div v-if="rounds.length > 1" class="round-list">
          <span class="sec-label">历史反馈轮次：</span>
          <button
            v-for="r in rounds"
            :key="r.id"
            class="chip"
            :class="{ active: selectedRound?.id === r.id }"
            @click="selectRound(r)"
          >
            {{ r.knowledge_point }} · {{ r.status === 'open' ? '进行中' : '已结束' }}
          </button>
        </div>

        <!-- 统计 -->
        <template v-if="stats">
          <div class="stat-cards">
            <div class="stat"><b>{{ stats.totalStudents }}</b><span>课堂总人数</span></div>
            <div class="stat"><b>{{ stats.submitCount }}</b><span>已提交</span></div>
            <div class="stat clickable" @click="openModal('未提交 · 到课', stats.inClassUnsubmitted, 'two')">
              <b>{{ stats.inClassUnsubmitted.length }}</b><span>未提交 · 到课</span>
            </div>
            <div class="stat clickable" @click="openModal('未提交 · 未到', stats.notInClassUnsubmitted, 'two')">
              <b>{{ stats.notInClassUnsubmitted.length }}</b><span>未提交 · 未到</span>
            </div>
            <div class="stat"><b>{{ stats.avgScore ?? '-' }}</b><span>平均分</span></div>
            <div class="stat"><b>{{ stats.variance ?? '-' }}</b><span>方差</span></div>
          </div>

          <!-- 表情分布 -->
          <div class="emoji-row">
            <div
              v-for="(e, i) in stats.emoji"
              :key="i"
              class="emoji-cell"
              @click="openModal(`${e} ${i + 1} 分 · ${stats.emojiLabel[i]} 学生名单`, stats.distributionStudents[i])"
            >
              <div class="emoji-big">{{ e }}</div>
              <div class="emoji-score">{{ i + 1 }} 分 · {{ stats.emojiLabel[i] }}</div>
              <div class="emoji-count">{{ stats.distribution[i] }} 人</div>
            </div>
          </div>

          <div class="charts">
            <div id="bar-chart" class="chart"></div>
            <div id="pie-chart" class="chart"></div>
          </div>

          <div class="snap-row">
            <button v-if="selectedRound.status === 'open'" class="primary" @click="makeSnapshot">📸 生成当前快照</button>
            <span class="tip">快照用于历史趋势与课程报告</span>
          </div>
          <div v-if="snapshots.length" class="snap-list">
            <div v-for="s in snapshots" :key="s.id" class="snap-item">
              {{ fmtTime(s.period_end) }} · 人数 {{ s.submit_count }} · 平均 {{ s.avg_score }} · 方差 {{ s.variance }}
            </div>
          </div>
        </template>
      </template>
      <div v-else-if="!loading" class="empty">该会话还没有反馈轮次，选择进行中的会话开启反馈</div>
    </main>

    <!-- 名单弹窗 -->
    <div v-if="modal.show" class="modal-mask" @click.self="closeModal">
      <div class="modal-box">
        <div class="modal-head">
          <b>{{ modal.title }}（{{ modal.list.length }} 人）</b>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="modal.list.length === 0" class="dim">无</div>
          <template v-else-if="modal.mode === 'two'">
            <div class="modal-table">
              <div class="mt-head"><span>学生名单</span><span>签到/补签 · 请假/缺勤</span></div>
              <div v-for="u in modal.list" :key="u.student_id" class="mt-row">
                <span class="mt-name">{{ u.name }}（{{ u.username }}）</span>
                <span class="mt-status">{{ statusText(u.status) }}</span>
              </div>
            </div>
          </template>
          <div v-else v-for="u in modal.list" :key="u.student_id" class="modal-item">
            {{ u.name }}（{{ u.username }}）
          </div>
        </div>
      </div>
    </div>
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
.session-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.sec-label { font-size: 13px; color: #6b7280; }
.chip {
  padding: 6px 14px; border: 1px solid #d1d5db; background: #fff; border-radius: 20px;
  font-size: 13px; cursor: pointer;
}
.chip.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.chip.live { border-color: #16a34a; color: #15803d; }
.chip.live.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.open-card {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;
}
.open-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.input {
  flex: 1; min-width: 240px; padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; background: #fff;
}
.w-90 { flex: 0 0 90px; min-width: 90px; }
.open-tip { color: #6b7280; font-size: 12px; margin-top: 8px; }
.primary {
  padding: 9px 18px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.danger {
  padding: 8px 16px; background: #fff; color: #dc2626; border: 1px solid #fca5a5;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.round-card {
  background: #fff; border: 1px solid #e5e7eb; border-left: 4px solid #16a34a;
  border-radius: 12px; padding: 14px 18px; margin-bottom: 14px;
  display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
}
.round-card.off { border-left-color: #9ca3af; }
.kp { font-size: 16px; }
.tag { display: inline-block; font-size: 12px; padding: 3px 12px; border-radius: 20px; font-weight: 500; margin-left: 8px; }
.t-live { background: #dcfce7; color: #15803d; }
.t-end { background: #f3f4f6; color: #6b7280; }
.round-meta { font-size: 12px; color: #6b7280; }
.countdown { color: #dc2626; font-weight: 600; margin-left: 8px; }
.round-actions { display: flex; gap: 10px; }
.round-list { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.stat-cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
.stat {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 10px;
  text-align: center;
}
.stat b { font-size: 26px; display: block; color: #1e293b; }
.stat span { font-size: 11px; color: #6b7280; }
.stat.clickable { cursor: pointer; transition: all 0.15s; }
.stat.clickable:hover { border-color: #2563eb; background: #eff6ff; transform: translateY(-2px); }
.emoji-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 18px; }
.emoji-cell {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 8px; text-align: center; cursor: pointer; transition: all 0.15s;
}
.emoji-cell:hover { border-color: #2563eb; background: #eff6ff; transform: translateY(-2px); }
.emoji-big { font-size: 34px; }
.emoji-score { font-size: 11px; color: #6b7280; margin: 6px 0 4px; }
.emoji-count { font-size: 15px; font-weight: 600; color: #1d4ed8; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
.chart { height: 300px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px; }
.snap-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.snap-list { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; }
.snap-item { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #374151; }
.snap-item:last-child { border-bottom: none; }
.empty { color: #9ca3af; text-align: center; padding: 30px 0; font-size: 13px; }
/* 名单弹窗 */
.modal-mask {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  width: 420px; max-width: 90vw; max-height: 70vh; background: #fff; border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2); display: flex; flex-direction: column;
}
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #f1f5f9; font-size: 15px;
}
.modal-close {
  border: none; background: #f3f4f6; border-radius: 50%; width: 28px; height: 28px;
  cursor: pointer; font-size: 13px; color: #374151;
}
.modal-body { padding: 12px 20px 20px; overflow-y: auto; }
.modal-item {
  padding: 10px 12px; border-bottom: 1px solid #f8fafc; font-size: 13px; color: #374151;
}
.modal-item:last-child { border-bottom: none; }
.dim { color: #9ca3af; font-size: 13px; }
.modal-table { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
.mt-head, .mt-row { display: flex; }
.mt-head { background: #f8fafc; font-size: 12px; color: #6b7280; font-weight: 600; }
.mt-head span, .mt-row span { flex: 1; padding: 9px 12px; }
.mt-row { border-top: 1px solid #f1f5f9; font-size: 13px; color: #374151; }
.mt-name { text-align: left; }
.mt-status { color: #1d4ed8; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
