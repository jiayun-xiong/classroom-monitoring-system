<script setup>
// 通用讨论面板：挂载到各功能页（签到/反馈/调查/作业），发言自动带来源进入课堂弹幕流
// props: courseId 课程id, source 来源, refId 来源对象id(可选), label 面板标题
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getDanmaku, sendDanmaku, toggleLike } from '../api/danmaku'

const props = defineProps({
  courseId: { type: [Number, String], required: true },
  source: { type: String, required: true },
  refId: { type: [Number, String], default: null },
  label: { type: String, default: '课堂讨论' },
})

const messages = ref([])
const input = ref('')
const msg = ref('')
let timer = null

function fmtTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function loadMessages() {
  if (!props.courseId) return
  try {
    const r = await getDanmaku(props.courseId, [props.source])
    messages.value = r.data.list
    nextTick(() => {
      const box = document.getElementById('panel-scroll')
      if (box) box.scrollTop = box.scrollHeight
    })
  } catch (e) {
    /* 忽略 */
  }
}

async function onSend() {
  const content = input.value.trim()
  if (!content) return
  const r = await sendDanmaku(props.courseId, {
    source: props.source,
    refId: props.refId,
    content,
  })
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

onMounted(() => {
  loadMessages()
  timer = setInterval(loadMessages, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="panel">
    <div class="p-head">
      <b>{{ label }}</b>
      <span class="p-count">{{ messages.length }} 条</span>
    </div>
    <div id="panel-scroll" class="p-scroll">
      <div v-if="messages.length === 0" class="p-empty">还没有讨论，来说两句吧</div>
      <div v-for="m in messages" :key="m.id" class="p-item" :class="{ teacher: m.senderRole === 'teacher', admin: m.senderRole === 'admin' }">
        <div class="p-meta">
          <span class="p-name">
            <em v-if="m.senderRole === 'teacher'">教师</em>
            <em v-else-if="m.senderRole === 'admin'">管理</em>
            {{ m.senderName }}
          </span>
          <span class="p-time">{{ fmtTime(m.createdAt) }}</span>
          <button class="p-like" :class="{ liked: m.liked }" @click="onLike(m, $event)">👍 {{ m.likes }}</button>
        </div>
        <div class="p-content">{{ m.content }}</div>
      </div>
    </div>
    <div class="p-send">
      <input v-model="input" placeholder="参与讨论（同步进入课堂弹幕流）" @keyup.enter="onSend" />
      <button @click="onSend">发送</button>
    </div>
    <div v-if="msg" class="p-msg">{{ msg }}</div>
  </div>
</template>

<style scoped>
.panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
.p-head { padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.p-count { color: #94a3b8; font-size: 12px; }
.p-scroll { max-height: 320px; overflow-y: auto; padding: 10px 14px; }
.p-empty { color: #94a3b8; text-align: center; padding: 24px 0; font-size: 13px; }
.p-item { padding: 8px 10px; border-radius: 8px; margin-bottom: 8px; background: #f8fafc; }
.p-item.teacher { background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; }
.p-item.admin { background: rgba(168, 85, 247, 0.1); border-left: 3px solid #a855f7; }
.p-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.p-name { font-size: 13px; font-weight: 600; color: #334155; }
.p-name em { font-style: normal; color: #f59e0b; font-size: 11px; margin-right: 2px; }
.p-time { color: #94a3b8; font-size: 11px; }
.p-like { margin-left: auto; background: none; border: none; color: #94a3b8; font-size: 12px; cursor: pointer; }
.p-like.liked { color: #f59e0b; }
.p-content { font-size: 14px; color: #334155; word-break: break-all; }
.p-send { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #e2e8f0; }
.p-send input { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.p-send button { background: #2563eb; border: none; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.p-msg { padding: 0 14px 10px; color: #dc2626; font-size: 12px; }
</style>
