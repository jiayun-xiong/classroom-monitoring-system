<script setup>
// 通用通知铃铛（右上角）：未读红点数字 + 点击进入通知中心
// props: path 通知中心路由
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getUnreadCount } from '../api/notification'

const props = defineProps({
  path: { type: String, required: true },
})
const router = useRouter()
const unread = ref(0)
let timer = null

async function load() {
  try {
    const r = await getUnreadCount()
    unread.value = Number(r.data.count) || 0
  } catch (e) {
    /* 忽略 */
  }
}

function onUnreadChanged() { load() }

onMounted(() => {
  load()
  timer = setInterval(load, 1000)
  window.addEventListener('notify-unread-changed', onUnreadChanged)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('notify-unread-changed', onUnreadChanged)
})
</script>

<template>
  <button class="bell" :title="unread ? `${unread} 条未读通知` : '通知中心'" @click="router.push(props.path)">
    <span class="bell-icon">🔔</span>
    <span v-if="unread > 0" class="badge">{{ unread > 99 ? '99+' : unread }}</span>
  </button>
</template>

<style scoped>
.bell {
  position: relative; background: none; border: none; cursor: pointer;
  width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.bell:hover { background: #f1f5f9; }
.bell-icon { font-size: 19px; line-height: 1; }
.badge {
  position: absolute; top: -4px; right: -6px;
  background: #dc2626; color: #fff; font-size: 11px; font-weight: 600;
  min-width: 18px; height: 18px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; padding: 0 4px;
}
</style>
