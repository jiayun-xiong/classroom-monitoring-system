<script setup>
// 教师端-上课窗口（第三版）：白底 + PPT 灰色虚化 + 右下角上传课件
// 弹幕流（多来源聚合）+ 控制（匿名/暂停/页码/字体/透明度/占比）
// 交互：点击弹幕 → 全局暂停 + 查看来源详情；关闭详情恢复；再次点击可跳转来源页
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getClassroomStatus, getDanmaku, sendDanmaku, toggleLike, setDanmakuPause, setDanmakuAnonymous, setDanmakuPage } from '../../api/danmaku'
import { startSession, endSession } from '../../api/checkin'
import { getCourses } from '../../api/course'

const route = useRoute()
const router = useRouter()
const courseId = route.params.id
const courseName = ref('')
const session = ref(null)
const messages = ref([])
const paused = ref(false)
const currentPage = ref(1)
const anonymousLive = ref(false)
const msg = ref('')

// PPT 页面：默认示例课件 3 页，上传后替换为自定义课件
const pages = ref(['/ppts/ppt1.png', '/ppts/ppt2.png', '/ppts/ppt3.png'])
const pptName = ref('')
const PPT_COUNT = computed(() => pages.value.length)

// 来源筛选
const sources = ref(['live', 'checkin', 'emotion', 'survey', 'homework'])
const sourceOptions = [
  { key: 'live', label: '实时', color: '#2563eb' },
  { key: 'checkin', label: '签到', color: '#059669' },
  { key: 'emotion', label: '反馈', color: '#d97706' },
  { key: 'survey', label: '调查', color: '#7c3aed' },
  { key: 'homework', label: '作业', color: '#db2777' },
]
const SOURCE_COLOR = { live: '#2563eb', checkin: '#059669', emotion: '#d97706', survey: '#7c3aed', homework: '#db2777' }

// 弹幕外观设置
const fontSize = ref(15)
const danmakuHeight = ref(46)

// 详情（暂停）状态
const detail = ref(null)
const input = ref('')
let timer = null
const fileInput = ref(null)

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

async function loadStatus() {
  try {
    const r = await getClassroomStatus(courseId)
    session.value = r.data.session
    paused.value = r.data.paused
    currentPage.value = r.data.currentPage
    anonymousLive.value = r.data.anonymousLive
  } catch (e) {
    /* 忽略 */
  }
}

async function loadMessages() {
  try {
    const r = await getDanmaku(courseId, sources.value)
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
  } catch (e) {
    /* 忽略 */
  }
}

async function onStart() {
  const r = await startSession(courseId)
  if (r.code === 0) {
    msg.value = '已开始上课'
    loadStatus()
  } else {
    msg.value = r.message
  }
}

async function onEnd() {
  if (!session.value) return
  const r = await endSession(session.value.id)
  if (r.code === 0) {
    msg.value = '已结束本节课'
    session.value = null
  } else {
    msg.value = r.message
  }
}

async function onSend() {
  const content = input.value.trim()
  if (!content) return
  const r = await sendDanmaku(courseId, { source: 'live', content })
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

async function onTapMessage(m) {
  if (!detail.value) {
    await setDanmakuPause(courseId, true)
    paused.value = true
    detail.value = m
    return
  }
  if (detail.value.id === m.id) {
    if (m.link) {
      await closeDetail()
      router.push(m.link)
    }
    return
  }
  detail.value = m
}

async function closeDetail() {
  detail.value = null
  await setDanmakuPause(courseId, false)
  paused.value = false
  scrollToBottom()
}

async function onToggleAnonymous() {
  const r = await setDanmakuAnonymous(courseId, !anonymousLive.value)
  if (r.code === 0) anonymousLive.value = r.data.enabled
}

async function onPage(delta) {
  const next = Math.min(Math.max(1, currentPage.value + delta), PPT_COUNT.value)
  if (next === currentPage.value) return
  currentPage.value = next
  await setDanmakuPage(courseId, next)
}

function onToggleSource(key) {
  const i = sources.value.indexOf(key)
  if (i >= 0) sources.value.splice(i, 1)
  else sources.value.push(key)
  loadMessages()
}

// 上传课件（图片序列，本页会话内展示，页码同步）
function onUploadClick() {
  fileInput.value && fileInput.value.click()
}

async function onFileChange(e) {
  const files = Array.from(e.target.files || [])
  if (!files.length) return
  const readers = files.map((f) =>
    new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.readAsDataURL(f)
    })
  )
  const list = await Promise.all(readers)
  pages.value = list
  pptName.value = files.map((f) => f.name).join('、')
  currentPage.value = 1
  await setDanmakuPage(courseId, 1)
  msg.value = `课件已上传（${files.length} 页）`
  e.target.value = ''
}

async function loadCourse() {
  try {
    const r = await getCourses()
    const c = r.data.list.find((x) => Number(x.id) === Number(courseId))
    if (c) courseName.value = c.name
  } catch (e) {
    /* 忽略 */
  }
}

onMounted(async () => {
  await Promise.all([loadStatus(), loadCourse()])
  await loadMessages()
  scrollToBottom()
  timer = setInterval(loadMessages, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/teacher/courses/${courseId}`) }
</script>

<template>
  <div class="page">
    <!-- 顶部控制条 -->
    <div class="topbar">
      <div class="left">
        <button class="btn-back" @click="goBack">←</button>
        <b>{{ courseName || '课堂' }}</b>
        <span class="status" :class="{ on: session }">{{ session ? '上课中' : '未上课' }}</span>
        <button v-if="!session" class="btn-start" @click="onStart">开始上课</button>
        <button v-else class="btn-end" @click="onEnd">结束上课</button>
      </div>
      <div class="right">
        <label class="mini">匿名实时弹幕</label>
        <input type="checkbox" :checked="anonymousLive" @change="onToggleAnonymous" />
        <label class="mini">字体</label>
        <input type="range" min="8" max="24" v-model.number="fontSize" />
        <label class="mini">尺寸</label>
        <input type="range" min="20" max="70" v-model.number="danmakuHeight" />
        <span v-if="msg" class="toast">{{ msg }}</span>
      </div>
    </div>

    <!-- PPT + 弹幕 主体（白底，PPT 灰色虚化） -->
    <div class="stage" :style="{ '--dm-h': danmakuHeight + '%' }">
      <div class="ppt-box">
        <img :src="pages[currentPage - 1]" class="ppt-img" alt="课件" />
        <span v-if="pptName" class="ppt-tag">{{ pptName }}</span>
        <div class="ppt-nav">
          <button @click="onPage(-1)" :disabled="currentPage === 1">◀</button>
          <span>{{ currentPage }} / {{ PPT_COUNT }}</span>
          <button @click="onPage(1)" :disabled="currentPage === PPT_COUNT">▶</button>
        </div>
        <!-- 上传课件（PPT 框右下角） -->
        <button class="upload-btn" @click="onUploadClick">+ 上传课件</button>
        <input ref="fileInput" type="file" accept="image/*" multiple class="hidden-input" @change="onFileChange" />
      </div>

      <!-- 弹幕层（下方区域） -->
      <div class="dm-layer" :style="{ fontSize: fontSize + 'px' }">
        <div class="dm-head">
          <span>课堂弹幕</span>
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
            @click="onTapMessage(m)"
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
          <input v-model="input" placeholder="发实时弹幕（Enter 发送）" @keyup.enter="onSend" />
          <button @click="onSend">发送</button>
        </div>
      </div>

      <!-- 来源筛选（右上） -->
      <div class="src-filter">
        <label v-for="s in sourceOptions" :key="s.key" class="f-item">
          <input type="checkbox" :checked="sources.includes(s.key)" @change="onToggleSource(s.key)" />
          <span :style="{ color: s.color }">{{ s.label }}</span>
        </label>
      </div>
    </div>

    <!-- 弹幕详情（暂停） -->
    <div v-if="detail" class="detail-mask" @click.self="closeDetail">
      <div class="detail-box">
        <div class="d-head">
          <span class="d-src" :style="{ background: SOURCE_COLOR[detail.source] }">{{ detail.sourceLabel }}</span>
          <b>{{ detail.senderName }}</b>
          <span class="d-time">{{ fmtTime(detail.createdAt) }}</span>
          <button class="d-close" @click="closeDetail">✕ 恢复弹幕</button>
        </div>
        <p class="d-content">{{ detail.content }}</p>
        <div class="d-actions">
          <button v-if="detail.link" class="d-jump" @click="closeDetail(); router.push(detail.link)">跳转来源页面 →</button>
          <span class="d-hint">全局弹幕已暂停（学生端同步）</span>
        </div>
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
.status { font-size: 12px; padding: 2px 10px; border-radius: 20px; background: #f1f5f9; color: #64748b; }
.status.on { background: #d1fae5; color: #047857; }
.btn-start { background: #2563eb; border: none; color: #fff; padding: 5px 14px; border-radius: 8px; cursor: pointer; }
.btn-end { background: #dc2626; border: none; color: #fff; padding: 5px 14px; border-radius: 8px; cursor: pointer; }
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
.ppt-tag { position: absolute; top: 8px; left: 12px; color: #94a3b8; font-size: 12px; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ppt-nav {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: #fff; color: #334155; padding: 5px 12px; border-radius: 20px; border: 1px solid #e5e7eb;
  display: flex; gap: 14px; align-items: center; font-size: 13px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.ppt-nav button { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 13px; }
.ppt-nav button:disabled { opacity: 0.35; }

.upload-btn {
  position: absolute; right: 14px; bottom: 14px; z-index: 20;
  background: #2563eb; color: #fff; border: none; border-radius: 20px; padding: 9px 18px;
  font-size: 13px; cursor: pointer; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
}
.upload-btn:hover { background: #1d4ed8; }
.hidden-input { display: none; }

.dm-layer {
  position: static; width: auto; max-width: none; margin: 10px 14px 14px;
  height: var(--dm-h); background: rgba(255, 255, 255, 0.92); border: 1px solid #e5e7eb;
  border-radius: 14px; display: flex; flex-direction: column; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.dm-head { padding: 8px 12px; color: #334155; font-size: 13px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #f1f5f9; }
.pause-tag { color: #d97706; font-size: 11px; }
.count { margin-left: auto; color: #94a3b8; }
.dm-scroll { flex: 1; overflow-y: auto; padding: 8px 10px; }
.dm-empty { color: #9ca3af; text-align: center; padding: 30px 0; font-size: 12px; }
.dm-item {
  display: flex; align-items: baseline; gap: 6px; padding: 5px 8px; border-radius: 8px;
  color: #1e293b; cursor: pointer; transition: background 0.15s; text-align: left;
}
.dm-item:hover { background: #f8fafc; }
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
.dm-send button { background: #2563eb; border: none; color: #fff; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }

.src-filter {
  position: absolute; top: 12px; right: 12px; background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px;
  display: flex; gap: 10px; align-items: center; font-size: 12px;
}
.f-item { display: flex; align-items: center; gap: 4px; color: #334155; cursor: pointer; }

.detail-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 50; }
.detail-box { background: #fff; color: #1e293b; border-radius: 14px; width: 520px; max-width: 92vw; padding: 18px 20px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2); }
.d-head { display: flex; align-items: center; gap: 10px; }
.d-src { color: #fff; font-size: 11px; padding: 2px 10px; border-radius: 10px; }
.d-time { color: #94a3b8; font-size: 12px; }
.d-close { margin-left: auto; background: #f1f5f9; border: 1px solid #e5e7eb; color: #374151; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; }
.d-content { font-size: 16px; margin: 14px 0; color: #334155; }
.d-actions { display: flex; align-items: center; gap: 12px; }
.d-jump { background: #2563eb; border: none; color: #fff; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.d-hint { color: #94a3b8; font-size: 11px; }
</style>
