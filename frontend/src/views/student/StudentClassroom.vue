<script setup>
// 学生端-进入课堂：PPT 跟随老师翻页 + 课堂弹幕（多来源，跟随老师全局暂停）
// 学生可：来源筛选、字体大小调节、点赞、发实时弹幕（上课中）
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getClassroomStatus, getDanmaku, sendDanmaku, toggleLike } from '../../api/danmaku'
import { getCourses as getMyCourses } from '../../api/course'

const route = useRoute()
const router = useRouter()
const courses = ref([])
const courseId = ref(null)
const courseName = ref('')
const session = ref(null)
const messages = ref([])
const paused = ref(false)
const currentPage = ref(1)
const anonymousLive = ref(false)
const fontSize = ref(15)
const danmakuHeight = ref(46)
const input = ref('')
const msg = ref('')

const sources = ref(['live', 'checkin', 'emotion', 'survey', 'homework'])
const sourceOptions = [
  { key: 'live', label: '实时', color: '#2563eb' },
  { key: 'checkin', label: '签到', color: '#059669' },
  { key: 'emotion', label: '反馈', color: '#d97706' },
  { key: 'survey', label: '调查', color: '#7c3aed' },
  { key: 'homework', label: '作业', color: '#db2777' },
]
const SOURCE_COLOR = { live: '#2563eb', checkin: '#059669', emotion: '#d97706', survey: '#7c3aed', homework: '#db2777' }
const PPT_COUNT = 3
let timer = null

function fmtTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleTimeString('zh-CN', { hour12: false })
}
function scrollToBottom() {
  nextTick(() => {
    const box = document.getElementById('dm-scroll')
    if (box) box.scrollTop = box.scrollHeight
  })
}

async function loadCourses() {
  const r = await getMyCourses()
  courses.value = r.data.list || []
  if (courses.value.length) {
    const q = Number(route.query.courseId)
    const target = q ? courses.value.find((x) => Number(x.id) === q) : null
    courseId.value = target ? Number(target.id) : Number(courses.value[0].id)
    courseName.value = target ? target.name : courses.value[0].name
    await refreshAll()
  }
}

async function refreshAll() {
  if (!courseId.value) return
  try {
    const st = await getClassroomStatus(courseId.value)
    session.value = st.data.session
    paused.value = st.data.paused
    currentPage.value = st.data.currentPage
    anonymousLive.value = st.data.anonymousLive
  } catch (e) { /* 忽略 */ }
  await loadMessages()
}

async function loadMessages() {
  if (!courseId.value) return
  try {
    const r = await getDanmaku(courseId.value, sources.value)
    const list = r.data.list
    const oldIds = new Set(messages.value.map((m) => m.id))
    const fresh = list.filter((m) => !oldIds.has(m.id))
    const same = list.length === messages.value.length && list.every((m, i) => m.id === messages.value[i].id)
    if (!same) {
      messages.value = list
      if (fresh.length && !paused.value) scrollToBottom()
    }
    paused.value = r.data.paused
    currentPage.value = r.data.currentPage
  } catch (e) { /* 忽略 */ }
}

async function onSend() {
  if (!session.value) {
    msg.value = '老师未开始上课，暂不能发送实时弹幕'
    return
  }
  const content = input.value.trim()
  if (!content) return
  const r = await sendDanmaku(courseId.value, { source: 'live', content })
  if (r.code === 0) {
    input.value = ''
    loadMessages()
  } else {
    msg.value = r.message
  }
}

async function onLike(m, e) {
  e.stopPropagation()
  const r = await toggleLike(m.id)
  if (r.code === 0) {
    m.likes = r.data.likes
    m.liked = r.data.liked
  }
}

function onToggleSource(key) {
  const i = sources.value.indexOf(key)
  if (i >= 0) sources.value.splice(i, 1)
  else sources.value.push(key)
  loadMessages()
}

async function onSelectCourse(c) {
  courseId.value = Number(c.id)
  courseName.value = c.name
  messages.value = []
  await refreshAll()
  scrollToBottom()
}

onMounted(async () => {
  await loadCourses()
  timer = setInterval(() => {
    refreshAll()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/student/courses/${courseId}`) }
</script>

<template>
  <div class="page">
    <!-- 顶部 -->
    <div class="topbar">
      <div class="left">
        <button class="btn-back" @click="goBack">←</button>
        <select v-if="courses.length" class="course-sel" :value="courseId" @change="onSelectCourse(courses.find((c) => Number(c.id) === Number($event.target.value)))">
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <b v-if="!courses.length">暂无课程</b>
        <span class="status" :class="{ on: session }">{{ session ? '上课中' : '未上课' }}</span>
      </div>
      <div class="right">
        <label class="mini">字体</label>
        <input type="range" min="8" max="24" v-model.number="fontSize" />
        <label class="mini">尺寸</label>
        <input type="range" min="20" max="70" v-model.number="danmakuHeight" />
        <span v-if="msg" class="toast">{{ msg }}</span>
      </div>
    </div>

    <div class="stage" :style="{ '--dm-h': danmakuHeight + '%' }">
      <!-- PPT -->
      <div class="ppt-box">
        <img v-if="courseId" :src="`/ppts/ppt${currentPage}.png`" class="ppt-img" alt="课件" />
        <div v-else class="ppt-empty">请先加入课堂，在"我的课程"中加入课堂码</div>
        <div class="ppt-page" v-if="courseId">{{ currentPage }} / {{ PPT_COUNT }}</div>
      </div>

      <!-- 弹幕层 -->
      <div class="dm-layer" :style="{ fontSize: fontSize + 'px' }">
        <div class="dm-head">
          <span>课堂弹幕 <i class="src-hint">来源 · 角色 · 内容</i></span>
          <span v-if="paused" class="pause-tag">⏸ 老师暂停中</span>
          <span class="count">{{ messages.length }}</span>
        </div>
        <div id="dm-scroll" class="dm-scroll">
          <div v-if="messages.length === 0" class="dm-empty">暂无弹幕</div>
          <div
            v-for="m in messages"
            :key="m.id"
            class="dm-item"
            :class="{ teacher: m.senderRole === 'teacher', admin: m.senderRole === 'admin' }"
          >
            <span class="dm-src" :style="{ background: SOURCE_COLOR[m.source] }">{{ m.sourceLabel }}</span>
            <span class="dm-name" :class="{ anon: m.isAnonymous }">
              <em v-if="m.senderRole === 'teacher'">教师</em>
              <em v-else-if="m.senderRole === 'admin'">管理</em>
              {{ m.senderName }}
            </span>
            <span class="dm-content">{{ m.content }}</span>
            <span class="dm-time">{{ fmtTime(m.createdAt) }}</span>
            <button class="dm-like" :class="{ liked: m.liked }" @click="onLike(m, $event)">👍 {{ m.likes }}</button>
          </div>
        </div>
        <div class="dm-send">
          <input
            v-model="input"
            :placeholder="session ? '发实时弹幕（Enter 发送）' : '老师未开始上课，暂时无法发送'"
            :disabled="!session"
            @keyup.enter="onSend"
          />
          <button :disabled="!session" @click="onSend">发送</button>
        </div>
      </div>

      <!-- 来源筛选 -->
      <div class="src-filter">
        <span class="f-label">来源</span>
        <label v-for="s in sourceOptions" :key="s.key" class="f-item">
          <input type="checkbox" :checked="sources.includes(s.key)" @change="onToggleSource(s.key)" />
          <span :style="{ color: s.color }">{{ s.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; height: 100vh; display: flex; flex-direction: column; background: #fff; }
.topbar {
  height: 48px; background: #fff; color: #1e293b; display: flex; justify-content: space-between; align-items: center;
  padding: 0 16px; font-size: 14px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;
}
.left { display: flex; align-items: center; gap: 10px; }
.btn-back { background: #f8fafc; border: 1px solid #e5e7eb; color: #374151; border-radius: 8px; padding: 4px 10px; cursor: pointer; }
.course-sel { background: #f8fafc; border: 1px solid #e5e7eb; color: #1e293b; border-radius: 8px; padding: 5px 8px; font-size: 13px; }
.status { font-size: 12px; padding: 2px 10px; border-radius: 20px; background: #f1f5f9; color: #64748b; }
.status.on { background: #d1fae5; color: #047857; }
.right { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.mini { color: #64748b; }
.toast { color: #d97706; margin-left: 8px; }

.stage { position: relative; flex: 1; overflow: hidden; background: #f3f4f6; display: flex; flex-direction: column; }
.ppt-box {
  position: relative; flex: 1; min-height: 0; margin: 10px 14px 0;
  display: flex; align-items: center; justify-content: center;
  background: #e5e7eb; border: 1px dashed #cbd5e1; border-radius: 12px; overflow: hidden;
}
.ppt-img { max-width: 100%; max-height: 100%; object-fit: contain; filter: saturate(0.85) brightness(0.98); }
.ppt-empty { color: #94a3b8; }
.ppt-page { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid #e5e7eb; color: #334155; padding: 4px 14px; border-radius: 20px; font-size: 13px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); }

.dm-layer {
  position: static; width: auto; max-width: none; margin: 10px 14px 14px;
  height: var(--dm-h); background: rgba(255, 255, 255, 0.92); border: 1px solid #e5e7eb;
  border-radius: 14px; display: flex; flex-direction: column; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.dm-head { padding: 8px 12px; color: #334155; font-size: 13px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #f1f5f9; }
.src-hint { color: #94a3b8; font-size: 11px; }
.pause-tag { color: #d97706; font-size: 11px; }
.count { margin-left: auto; color: #94a3b8; }
.dm-scroll { flex: 1; overflow-y: auto; padding: 8px 10px; }
.dm-empty { color: #9ca3af; text-align: center; padding: 30px 0; font-size: 12px; }
.dm-item { display: flex; align-items: baseline; gap: 6px; padding: 5px 8px; border-radius: 8px; color: #1e293b; text-align: left; }
.dm-item.teacher { background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; }
.dm-item.admin { background: rgba(168, 85, 247, 0.1); border-left: 3px solid #a855f7; }
.dm-src { flex-shrink: 0; color: #fff; font-size: 10px; padding: 1px 8px; border-radius: 10px; }
.dm-name { color: #2563eb; font-size: 12px; flex-shrink: 0; }
.dm-name.anon { color: #64748b; }
.dm-name em { font-style: normal; color: #d97706; font-size: 11px; margin-right: 2px; }
.dm-content { flex: 1; word-break: break-all; }
.dm-time { color: #94a3b8; font-size: 10px; flex-shrink: 0; }
.dm-like { background: none; border: none; color: #94a3b8; font-size: 11px; cursor: pointer; flex-shrink: 0; }
.dm-like.liked { color: #d97706; }
.dm-send { display: flex; gap: 8px; padding: 8px 10px; border-top: 1px solid #f1f5f9; }
.dm-send input { flex: 1; background: #f8fafc; border: 1px solid #e5e7eb; color: #1e293b; padding: 7px 10px; border-radius: 8px; font-size: 13px; }
.dm-send input:disabled { opacity: 0.5; }
.dm-send button { background: #2563eb; border: none; color: #fff; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.dm-send button:disabled { opacity: 0.5; }

.src-filter {
  position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px;
  display: flex; gap: 10px; align-items: center; font-size: 12px;
}
.f-label { color: #94a3b8; }
.f-item { display: flex; align-items: center; gap: 4px; color: #334155; cursor: pointer; }

@media (max-width: 640px) {
  .dm-item { flex-wrap: wrap; row-gap: 2px; align-items: center; }
  .dm-content { flex: 1 1 100%; order: 3; }
  .dm-time { order: 4; margin-left: auto; }
  .dm-like { order: 4; }
  .topbar { flex-wrap: wrap; height: auto; padding: 6px 10px; row-gap: 4px; }
  .right { width: 100%; justify-content: flex-end; }
  .dm-send { flex-direction: column; gap: 8px; }
  .ppt-box img { max-width: 100%; height: auto; }
}
</style>
