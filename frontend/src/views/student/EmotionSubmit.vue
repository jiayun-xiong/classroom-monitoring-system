<script setup>
const router = useRouter()
// 学生端-表情反馈：查看当前开放反馈轮次（知识点+倒计时）→ 6 表情提交 + 我的表情记录
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCourses } from '../../api/course'
import { getSessions } from '../../api/checkin'
import { getActiveRound, submitRoundEmotion, getMyEmotions } from '../../api/emotion'

const EMOJI = ['😵', '😕', '😐', '🙂', '😊', '🤩']
const EMOJI_LABEL = ['完全没理解', '基本没理解', '有点模糊', '基本掌握', '掌握不错', '完全理解']

const courses = ref([])
const myRecords = ref([])
const message = ref('')
const submitting = ref(false)

// 进行中的课堂（含当前开放反馈轮次信息）
const liveSessions = ref([])
const remaining = ref(0)
let countdownTimer = null

async function fetchData() {
  try {
    const res = await getCourses()
    courses.value = res.data.list
    const live = []
    for (const c of courses.value) {
      try {
        const sr = await getSessions(c.id)
        const ongoing = (sr.data.sessions || []).filter((s) => s.status === 'ongoing')
        for (const s of ongoing) {
          let roundInfo = { round: null, myScore: null, remainingSeconds: 0 }
          try {
            const rr = await getActiveRound(s.id)
            roundInfo = rr.data
          } catch (e) {
            // 无开放轮次
          }
          live.push({ course: c, session: s, ...roundInfo })
        }
      } catch (e) {
        // 忽略
      }
    }
    liveSessions.value = live
    // 更新倒计时（取最早的开放轮次剩余时间）
    const openRounds = live.filter((x) => x.round)
    if (openRounds.length) {
      remaining.value = Math.max(...openRounds.map((x) => x.remainingSeconds))
      stopCountdown()
      countdownTimer = setInterval(() => {
        remaining.value = Math.max(0, remaining.value - 1)
      }, 1000)
    } else {
      stopCountdown()
    }
    const hist = await getMyEmotions()
    myRecords.value = hist.data.records
  } catch (e) {
    message.value = '加载失败：' + e.message
  }
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

async function doSubmit(roundId, score) {
  if (submitting.value) return
  submitting.value = true
  message.value = ''
  try {
    const res = await submitRoundEmotion(roundId, score)
    message.value = res.message
    fetchData()
  } catch (e) {
    message.value = e.message
  } finally {
    submitting.value = false
  }
}

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function fmtRemaining(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

let pollTimer = null

onMounted(() => {
  fetchData()
  // 实时感知教师端开放的反馈轮次
  pollTimer = setInterval(fetchData, 1000)
})
onUnmounted(() => {
  stopCountdown()
  if (pollTimer) clearInterval(pollTimer)
})
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
      <h2>表情反馈</h2>
      <p class="tip">教师开启反馈后，选择最能代表你当前理解程度的表情（6 分=完全理解，1 分=完全没理解），可随时更新</p>
      <p v-if="message" class="msg" :class="{ err: message.includes('失败') }">{{ message }}</p>

      <h3 class="sec">进行中的课堂（{{ liveSessions.length }} 个）</h3>
      <div v-if="liveSessions.length === 0" class="empty">当前没有进行中的课堂，老师开始上课后这里会显示</div>
      <div v-for="item in liveSessions" :key="item.session.id" class="live-box">
        <div class="live-head">
          <b>{{ item.course.name }}</b>
          <span v-if="item.round" class="tag t-live">● 反馈进行中 · 剩余 {{ fmtRemaining(item.remainingSeconds) }}</span>
          <span v-else class="tag t-wait">暂未开启反馈</span>
        </div>

        <template v-if="item.round">
          <div class="kp-bar">
            本次反馈知识点：<b>「{{ item.round.knowledge_point }}」</b>
            <span v-if="item.myScore" class="mine">我已提交：{{ EMOJI[item.myScore - 1] }}（{{ item.myScore }} 分）</span>
          </div>
          <div class="emoji-grid">
            <button
              v-for="(e, i) in EMOJI"
              :key="i"
              class="emoji-btn"
              :disabled="submitting"
              @click="doSubmit(item.round.id, i + 1)"
            >
              <div class="e-big">{{ e }}</div>
              <div class="e-label">{{ i + 1 }} 分 · {{ EMOJI_LABEL[i] }}</div>
            </button>
          </div>
        </template>
        <div v-else class="wait">老师暂未开启表情反馈，开启后会显示知识点与表情按钮</div>
        <DanmakuPanel :course-id="item.course.id" source="emotion" :ref-id="item.round ? item.round.id : null" label="课堂讨论 · 表情反馈" class="dm-panel" />
      </div>

      <h3 class="sec">我的表情记录（最近 {{ myRecords.length }} 条）</h3>
      <div v-if="myRecords.length === 0" class="empty">还没有表情反馈记录</div>
      <div v-else class="history">
        <div v-for="r in myRecords" :key="r.id" class="his-row">
          <div>
            <b>{{ EMOJI[r.score - 1] }} {{ r.score }} 分</b>
            <div class="his-meta">
              {{ r.knowledge_point ? '知识点：' + r.knowledge_point + ' · ' : '' }}{{ r.session?.course?.name || '未知课程' }} · {{ fmtTime(r.created_at) }}
            </div>
          </div>
          <span class="tag t-end">{{ EMOJI_LABEL[r.score - 1] }}</span>
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
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.sec { font-size: 16px; margin: 26px 0 12px; }
.msg { color: #047857; font-size: 14px; margin: 0 0 12px; }
.msg.err { color: #dc2626; }
.live-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin-bottom: 14px; }
.live-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 16px; }
.tag { display: inline-block; font-size: 12px; padding: 3px 12px; border-radius: 20px; font-weight: 500; }
.t-live { background: #dcfce7; color: #15803d; }
.t-wait { background: #fef3c7; color: #b45309; }
.t-end { background: #f3f4f6; color: #6b7280; }
.kp-bar { background: #f0f7ff; border: 1px solid #dbeafe; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #374151; }
.mine { color: #1d4ed8; margin-left: 12px; }
.emoji-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.emoji-btn {
  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 6px; cursor: pointer; transition: all 0.15s;
}
.emoji-btn:hover { border-color: #2563eb; background: #eff6ff; transform: translateY(-2px); }
.emoji-btn:disabled { opacity: 0.6; }
.e-big { font-size: 34px; }
.e-label { font-size: 11px; color: #6b7280; margin-top: 6px; }
.wait { color: #b45309; font-size: 13px; padding: 10px 0; }
.history { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
.his-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 13px 18px; border-bottom: 1px solid #f1f5f9;
}
.his-row:last-child { border-bottom: none; }
.his-meta { color: #9ca3af; font-size: 12px; margin-top: 4px; }
.empty { text-align: center; color: #9ca3af; padding: 30px 0; }
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
  .history { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .emoji-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
