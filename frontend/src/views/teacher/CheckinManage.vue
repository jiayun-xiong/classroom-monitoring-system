<script setup>
const router = useRouter()
// 教师端-课堂定位签到：开始/结束上课、发布签到、签到统计与补签/请假
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { startSession, endSession, getSessions, publishCheckin, getCheckinStats, makeupCheckin, leaveCheckin } from '../../api/checkin'
import { useRouter } from 'vue-router'

const route = useRoute()
const courseId = route.params.id

const loading = ref(false)
const message = ref('')
const sessions = ref([])
const ongoingSession = ref(null)
const nowTs = ref(Date.now())

// 发布签到
const showPublish = ref(false)
const pubForm = ref({ lat: null, lng: null, windowMinutes: 5 })
const locating = ref(false)

// 统计弹窗
const showStats = ref(false)
const stats = ref(null)
const statsLoading = ref(false)

let timer = null

function fetchAll() {
  fetchSessions()
}

async function fetchSessions() {
  loading.value = true
  try {
    const res = await getSessions(courseId)
    sessions.value = res.data.sessions
    ongoingSession.value = sessions.value.find((s) => s.status === 'ongoing') || null
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

async function begin() {
  if (!confirm('确定开始上课？')) return
  try {
    const res = await startSession(courseId)
    message.value = res.message
    fetchSessions()
  } catch (e) {
    message.value = e.message
  }
}

async function end() {
  if (!confirm('确定结束上课？进行中的签到将同步截止。')) return
  try {
    const res = await endSession(ongoingSession.value.id)
    message.value = res.message
    fetchSessions()
  } catch (e) {
    message.value = e.message
  }
}

// 获取教师当前位置（发布签到基准点）
function openPublish() {
  message.value = ''
  locating.value = true
  if (!navigator.geolocation) {
    message.value = '浏览器不支持定位，请在支持的浏览器（Chrome/Edge）中使用'
    locating.value = false
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      pubForm.value.lat = pos.coords.latitude
      pubForm.value.lng = pos.coords.longitude
      locating.value = false
      showPublish.value = true
    },
    (err) => {
      locating.value = false
      message.value = '定位失败：' + (err.message || '请授权定位权限') + '（也可手动填写坐标）'
      pubForm.value.lat = 31.84
      pubForm.value.lng = 117.259
      showPublish.value = true
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

async function submitPublish() {
  const lat = Number(pubForm.value.lat)
  const lng = Number(pubForm.value.lng)
  if (isNaN(lat) || isNaN(lng)) {
    message.value = '请填写正确的经纬度'
    return
  }
  try {
    const res = await publishCheckin(ongoingSession.value.id, {
      lat,
      lng,
      windowMinutes: Number(pubForm.value.windowMinutes),
    })
    message.value = res.message
    showPublish.value = false
    fetchSessions()
  } catch (e) {
    message.value = e.message
  }
}

async function openStats(c) {
  showStats.value = true
  statsLoading.value = true
  stats.value = null
  try {
    const res = await getCheckinStats(c.id)
    stats.value = res.data
  } catch (e) {
    message.value = e.message
    showStats.value = false
  } finally {
    statsLoading.value = false
  }
}

async function doMakeup(s) {
  const reason = prompt(`为 ${s.student.name} 补签，填写原因（默认：教师补签）：`, '教师补签')
  if (reason === null) return
  try {
    await makeupCheckin(stats.value.checkin.id, { studentId: s.student.id, reason: reason || '教师补签' })
    message.value = '已补签'
    openStats(stats.value.checkin)
  } catch (e) {
    message.value = e.message
  }
}

async function doLeave(s) {
  const reason = prompt(`为 ${s.student.name} 登记请假，填写原因（默认：事假）：`, '事假')
  if (reason === null) return
  try {
    await leaveCheckin(stats.value.checkin.id, { studentId: s.student.id, reason: reason || '事假' })
    message.value = '已登记请假'
    openStats(stats.value.checkin)
  } catch (e) {
    message.value = e.message
  }
}

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function countdown(c) {
  const diff = new Date(c.end_time).getTime() - nowTs.value
  if (diff <= 0) return '已截止'
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}分${s}秒`
}

const statusText = { normal: '正常', late: '迟到', makeup: '补签', leave: '请假', absent: '缺勤', fail: '定位失败' }
const statusClass = { normal: 's-normal', late: 's-late', makeup: 's-makeup', leave: 's-leave', absent: 's-absent', fail: 's-fail' }

onMounted(() => {
  fetchAll()
  timer = setInterval(() => {
    nowTs.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(timer))

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/teacher/courses/${courseId}`) }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      
    </header>
    <main>
      <div class="head-row">
        <div>
          <h2>课堂定位签到</h2>
          <p class="tip">开始上课 → 发布定位签到（教师位置为基准点）→ 学生 200m 内签到成功</p>
        </div>
        <div class="head-btns">
          <button v-if="!ongoingSession" class="primary" @click="begin">开始上课</button>
          <template v-else>
            <button class="primary" @click="openPublish" :disabled="locating">{{ locating ? '获取定位中...' : '+ 发布签到' }}</button>
            <button class="danger" @click="end">结束上课</button>
          </template>
        </div>
      </div>
      <p v-if="message" class="msg">{{ message }}</p>

      <!-- 进行中的签到 -->
      <div v-if="ongoingSession" class="ongoing card">
        <h3>课堂进行中（{{ fmtTime(ongoingSession.start_time) }} 开始）</h3>
        <div v-for="c in ongoingSession.checkins.filter((x) => x.status === 'open')" :key="c.id" class="live-checkin">
          <div>
            <span class="live-dot"></span> 签到进行中 · 剩余 <b>{{ countdown(c) }}</b>
            <span class="meta">（{{ c.window_minutes }} 分钟窗口，基准 {{ Number(c.teacher_lat).toFixed(4) }}, {{ Number(c.teacher_lng).toFixed(4) }}）</span>
          </div>
          <button class="primary sm" @click="openStats(c)">查看统计</button>
        </div>
        <p v-if="!ongoingSession.checkins.some((x) => x.status === 'open')" class="empty">暂无进行中的签到，点「发布签到」发起</p>
      </div>

      <!-- 签到历史 -->
      <h3 class="sec">签到历史（{{ sessions.reduce((a, s) => a + s.checkins.length, 0) }} 次）</h3>
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="sessions.length === 0" class="empty">还没有上课记录，点「开始上课」</div>
      <div v-else class="list">
        <div v-for="s in sessions" :key="s.id" class="session card">
          <div class="session-head">
            <b>{{ fmtTime(s.start_time) }}</b>
            <span class="tag" :class="s.status === 'ongoing' ? 't-live' : 't-end'">{{ s.status === 'ongoing' ? '进行中' : '已结束' }}</span>
          </div>
          <div v-if="s.checkins.length" class="checkin-rows">
            <div v-for="c in s.checkins" :key="c.id" class="checkin-row">
              <span>{{ fmtTime(c.start_time) }} · {{ c.window_minutes }} 分钟</span>
              <span class="tag" :class="c.status === 'open' ? 't-live' : 't-end'">{{ c.status === 'open' ? '开放中' : '已截止' }}</span>
              <button class="link" @click="openStats(c)">统计</button>
            </div>
          </div>
          <p v-else class="empty">本堂课未发布签到</p>
        </div>
      </div>

      <!-- 发布签到弹窗 -->
      <div v-if="showPublish" class="mask" @click.self="showPublish = false">
        <div class="dialog">
          <h3>发布定位签到</h3>
          <p class="tip">基准点 = 你的当前位置（可手动修正）</p>
          <div class="form-grid">
            <label>纬度<input v-model.number="pubForm.lat" type="number" step="0.0001" /></label>
            <label>经度<input v-model.number="pubForm.lng" type="number" step="0.0001" /></label>
            <label>开放时长（2-10 分钟）<input v-model.number="pubForm.windowMinutes" type="number" min="2" max="10" /></label>
          </div>
          <div class="dialog-btns">
            <button @click="showPublish = false">取消</button>
            <button class="primary" @click="submitPublish">发布</button>
          </div>
        </div>
      </div>

      <!-- 统计弹窗 -->
      <div v-if="showStats" class="mask" @click.self="showStats = false">
        <div class="dialog wide">
          <h3>签到统计 <span class="meta">{{ stats?.checkin ? fmtTime(stats.checkin.start_time) + ' · ' + stats.checkin.window_minutes + ' 分钟' : '' }}</span></h3>
          <div v-if="statsLoading" class="empty">加载中...</div>
          <template v-else-if="stats">
            <div class="stat-cards">
              <div class="stat"><b>{{ stats.shouldCount }}</b><span>应到</span></div>
              <div class="stat"><b>{{ stats.signedCount }}</b><span>已签</span></div>
              <div class="stat s-normal"><b>{{ stats.normalCount }}</b><span>正常</span></div>
              <div class="stat s-late"><b>{{ stats.lateCount }}</b><span>迟到</span></div>
              <div class="stat s-makeup"><b>{{ stats.makeupCount }}</b><span>补签</span></div>
              <div class="stat s-leave"><b>{{ stats.leaveCount }}</b><span>请假</span></div>
              <div class="stat s-absent"><b>{{ stats.absentCount }}</b><span>缺勤</span></div>
            </div>
            <table>
              <thead><tr><th>学生</th><th>状态</th><th>距离</th><th>原因</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="i in stats.list" :key="i.student.id">
                  <td>{{ i.student.name }}（{{ i.student.username }}）</td>
                  <td><span class="tag" :class="statusClass[i.status]">{{ statusText[i.status] }}</span></td>
                  <td>{{ i.distance !== null ? i.distance + ' 米' : '-' }}</td>
                  <td>{{ i.reason || '-' }}</td>
                  <td>
                    <button v-if="i.status === 'absent' || i.status === 'fail'" class="link" @click="doMakeup(i)">补签</button>
                    <button v-if="i.status === 'absent' || i.status === 'fail'" class="link danger" @click="doLeave(i)">请假</button>
                    <span v-else>-</span>
                  </td>
                </tr>
              </tbody>
            </table>
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
main { max-width: 1080px; margin: 0 auto; padding: 28px 20px; }
.head-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.head-btns { display: flex; gap: 10px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 14px; margin: 0 0 12px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.primary {
  padding: 10px 20px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 14px; cursor: pointer;
}
.primary.sm { padding: 6px 14px; font-size: 13px; }
.primary:disabled { opacity: 0.6; }
.danger {
  padding: 10px 20px; background: #fff; color: #dc2626; border: 1px solid #fca5a5;
  border-radius: 8px; font-size: 14px; cursor: pointer;
}
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
.ongoing { margin-bottom: 24px; }
.ongoing h3 { margin: 0 0 12px; font-size: 16px; }
.live-checkin {
  display: flex; justify-content: space-between; align-items: center;
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 16px;
}
.live-dot {
  display: inline-block; width: 8px; height: 8px; background: #16a34a; border-radius: 50%;
  margin-right: 6px; animation: blink 1.2s infinite;
}
@keyframes blink { 50% { opacity: 0.2; } }
.meta { color: #9ca3af; font-size: 12px; }
.sec { font-size: 16px; margin: 24px 0 12px; }
.list { display: flex; flex-direction: column; gap: 12px; }
.session-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.checkin-rows { border-top: 1px dashed #e5e7eb; }
.checkin-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #374151;
}
.tag {
  display: inline-block; font-size: 12px; padding: 2px 10px; border-radius: 20px; font-weight: 500;
}
.t-live { background: #dcfce7; color: #15803d; }
.t-end { background: #f3f4f6; color: #6b7280; }
.s-normal { background: #dcfce7; color: #15803d; }
.s-late { background: #fef3c7; color: #b45309; }
.s-makeup { background: #fef9c3; color: #a16207; }
.s-leave { background: #dbeafe; color: #1d4ed8; }
.s-absent { background: #fee2e2; color: #b91c1c; }
.s-fail { background: #ffedd5; color: #c2410c; }
.link { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 13px; padding: 2px 6px; }
.link.danger { color: #dc2626; }
.empty { color: #9ca3af; text-align: center; padding: 16px 0; font-size: 13px; }
.mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.dialog { width: 480px; background: #fff; border-radius: 14px; padding: 24px; }
.dialog.wide { width: 760px; max-height: 84vh; overflow: auto; }
.dialog h3 { margin: 0 0 12px; font-size: 17px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid label { font-size: 13px; color: #374151; display: flex; flex-direction: column; gap: 4px; }
.form-grid input {
  padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; outline: none;
}
.dialog-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.dialog-btns button {
  padding: 8px 18px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; font-size: 13px; cursor: pointer;
}
.dialog-btns .primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.stat-cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
.stat {
  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 12px; text-align: center;
}
.stat b { font-size: 22px; display: block; }
.stat span { font-size: 12px; color: #6b7280; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px 10px; text-align: left; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
th { background: #f8fafc; font-weight: 600; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
