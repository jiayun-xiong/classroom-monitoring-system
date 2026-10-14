<script setup>
const router = useRouter()
// 学生端-课堂签到：进行中的签到一键定位签到 + 我的签到历史
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCourses } from '../../api/course'
import { getSessions, getMyCheckins, signCheckin } from '../../api/checkin'

const courses = ref([])
const myRecords = ref([])
const loading = ref(false)
const message = ref('')
const signing = ref(false)
const nowTs = ref(Date.now())

let timer = null

// 获取/生成本设备标识（防代签：同设备本次签到仅一次）
function getDeviceId() {
  let id = localStorage.getItem('checkin_device_id')
  if (!id) {
    id = 'DEV-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('checkin_device_id', id)
  }
  return id
}

// 进行中的签到：从我的课程 → 会话列表里找 open 的 checkin
async function fetchData() {
  loading.value = true
  try {
    const res = await getCourses()
    courses.value = res.data.list
    // 逐课程拉取会话（含签到活动）
    for (const c of courses.value) {
      try {
        const sr = await getSessions(c.id)
        c.sessions = sr.data.sessions
      } catch (e) {
        c.sessions = []
      }
    }
    const hist = await getMyCheckins()
    myRecords.value = hist.data.records
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

// 汇总进行中的签到（course + session + checkin）
const liveList = computed(() => {
  const list = []
  courses.value.forEach((c) => {
    ;(c.sessions || []).forEach((s) => {
      ;(s.checkins || []).forEach((ch) => {
        if (ch.status === 'open' && new Date(ch.end_time).getTime() > nowTs.value) {
          const signed = myRecords.value.some(
            (r) => r.checkin && Number(r.checkin.id) === Number(ch.id) && (r.type === 'normal' || r.type === 'makeup' || r.result === 'success')
          )
          list.push({ course: c, session: s, checkin: ch, signed })
        }
      })
    })
  })
  return list
})

// 获取定位并签到
async function doSign(checkinId, courseName) {
  message.value = ''
  if (signing.value) return
  if (!navigator.geolocation) {
    message.value = '浏览器不支持定位，请使用 Chrome/Edge'
    return
  }
  signing.value = true
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const res = await signCheckin(checkinId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          deviceId: getDeviceId(),
        })
        if (res.code === 0) {
          message.value = `${courseName}：${res.message}`
          fetchData()
        } else {
          message.value = res.message
        }
      } catch (e) {
        message.value = e.message
      } finally {
        signing.value = false
      }
    },
    (err) => {
      signing.value = false
      message.value = '定位失败：' + (err.message || '请授权定位权限')
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

function countdown(endTime) {
  const diff = new Date(endTime).getTime() - nowTs.value
  if (diff <= 0) return '已截止'
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}分${s}秒`
}

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

const recText = { normal: '正常', late: '迟到', makeup: '补签', leave: '请假', absent: '缺勤' }
const recClass = { normal: 's-normal', late: 's-late', makeup: 's-makeup', leave: 's-leave', absent: 's-absent' }

onMounted(() => {
  fetchData()
  timer = setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))
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
      <h2>课堂签到</h2>
      <p v-if="message" class="msg" :class="{ err: message.includes('失败') || message.includes('截止') || message.includes('定位') }">{{ message }}</p>

      <!-- 进行中的签到 -->
      <h3 class="sec">进行中的签到（{{ liveList.length }} 个）</h3>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else>
        <div v-for="item in liveList" :key="item.checkin.id" class="live-card">
          <div class="live-info">
            <div class="live-name">{{ item.course.name }} · 签到进行中<span class="dot"></span></div>
            <div class="live-meta">剩余 <b>{{ countdown(item.checkin.end_time) }}</b> · 200 米内有效</div>
          </div>
          <button v-if="!item.signed" class="primary" :disabled="signing" @click="doSign(item.checkin.id, item.course.name)">
            {{ signing ? '提交中...' : '一键签到' }}
          </button>
          <span v-else class="tag-signed">已签到 ✓</span>
          <DanmakuPanel :course-id="item.course.id" source="checkin" :ref-id="item.checkin.id" label="课堂讨论 · 签到" class="dm-panel" />
        </div>
        <p v-if="liveList.length === 0" class="empty">当前没有进行中的签到（教师发布后这里会显示）</p>
      </div>

      <!-- 我的签到历史 -->
      <h3 class="sec">我的签到记录（最近 {{ myRecords.length }} 条）</h3>
      <div v-if="myRecords.length === 0" class="empty">还没有签到记录</div>
      <div v-else class="history">
        <div v-for="r in myRecords" :key="r.id" class="his-row">
          <div>
            <b>{{ r.checkin?.session?.course?.name || '未知课程' }}</b>
            <div class="his-meta">{{ fmtTime(r.signed_at) }} · {{ r.distance !== null ? r.distance + ' 米' : '-' }}</div>
          </div>
          <span class="tag" :class="recClass[r.type] || (r.result === 'success' ? 's-normal' : 's-fail')">
            {{ recText[r.type] || (r.result === 'success' ? '正常' : '定位失败') }}
          </span>
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
h2 { font-size: 22px; margin: 0 0 10px; }
.sec { font-size: 16px; margin: 26px 0 12px; }
.msg { color: #047857; font-size: 14px; margin: 0 0 12px; }
.msg.err { color: #dc2626; }
.live-card {
  display: flex; justify-content: space-between; align-items: center;
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;
  padding: 18px 20px; margin-bottom: 12px;
}
.live-name { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.dot {
  display: inline-block; width: 8px; height: 8px; background: #16a34a; border-radius: 50%;
  margin-left: 8px; animation: blink 1.2s infinite; vertical-align: middle;
}
@keyframes blink { 50% { opacity: 0.2; } }
.live-meta { color: #6b7280; font-size: 13px; }
.live-meta b { color: #1d4ed8; }
.primary {
  padding: 12px 26px; background: #2563eb; color: #fff; border: none;
  border-radius: 10px; font-size: 15px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; }
.tag-signed {
  display: inline-block; padding: 9px 22px; border-radius: 8px;
  background: #dcfce7; color: #15803d; font-size: 14px; font-weight: 600;
}
.empty { text-align: center; color: #9ca3af; padding: 30px 0; }
.history { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
.his-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
}
.his-row:last-child { border-bottom: none; }
.his-meta { color: #9ca3af; font-size: 12px; margin-top: 4px; }
.tag {
  display: inline-block; font-size: 12px; padding: 3px 12px; border-radius: 20px; font-weight: 500;
}
.s-normal { background: #dcfce7; color: #15803d; }
.s-makeup { background: #fef9c3; color: #a16207; }
.s-leave { background: #dbeafe; color: #1d4ed8; }
.s-absent { background: #fee2e2; color: #b91c1c; }
.s-fail { background: #ffedd5; color: #c2410c; }
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
}
</style>
