<script setup>
// 管理端-统计周期配置：学情统计周期（按周/按月/自定义区间）的新增、编辑、启停、删除
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listStatsPeriods, createStatsPeriod, updateStatsPeriod, deleteStatsPeriod } from '../../api/statsPeriod'

const router = useRouter()
const list = ref([])
const message = ref('')
const editing = ref(null) // null=新增，否则为编辑中的配置对象
const form = ref({
  name: '',
  periodType: 'weekly',
  startDate: '',
  endDate: '',
  semester: '',
  enabled: true,
})

const TYPE_LABEL = { weekly: '按周', monthly: '按月', custom: '自定义区间' }

async function load() {
  try {
    const res = await listStatsPeriods()
    list.value = res.data.list
  } catch (e) {
    message.value = e.message || '加载失败'
  }
}

function openCreate() {
  editing.value = { id: null }
  form.value = { name: '', periodType: 'weekly', startDate: '', endDate: '', semester: '', enabled: true }
}

function openEdit(cfg) {
  editing.value = { id: cfg.id }
  form.value = {
    name: cfg.name,
    periodType: cfg.period_type,
    startDate: cfg.start_date || '',
    endDate: cfg.end_date || '',
    semester: cfg.semester || '',
    enabled: !!cfg.enabled,
  }
}

async function save() {
  message.value = ''
  if (!form.value.name) { message.value = '请填写配置名称'; return }
  if (form.value.periodType === 'custom' && (!form.value.startDate || !form.value.endDate)) { message.value = '自定义周期需填写起止日期'; return }
  try {
    if (editing.value && editing.value.id) {
      await updateStatsPeriod(editing.value.id, form.value)
    } else {
      await createStatsPeriod(form.value)
    }
    editing.value = null
    await load()
  } catch (e) {
    message.value = e.message || '保存失败'
  }
}

async function toggle(cfg) {
  try {
    await updateStatsPeriod(cfg.id, { enabled: !cfg.enabled })
    await load()
  } catch (e) {
    message.value = e.message || '操作失败'
  }
}

async function remove(cfg) {
  message.value = ''
  if (!confirm(`确定删除统计周期「${cfg.name}」吗？`)) return
  try {
    await deleteStatsPeriod(cfg.id)
    await load()
  } catch (e) {
    message.value = e.message || '删除失败'
  }
}

onMounted(load)
function goBack() { if (window.history.length > 1) router.back(); else router.push('/admin') }
</script>

<template>
  <div class="page">
    <header>
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">管理端</span></div>
    </header>
    <main>
      <h2>统计周期配置</h2>
      <p class="tip">配置学情统计周期（按周 / 按月 / 自定义区间），学情报告按生效周期展示统计口径</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <div class="bar">
        <button class="add-btn" @click="openCreate">新增配置</button>
      </div>

      <div v-if="editing" class="form-card">
        <h3>{{ editing.id ? '编辑配置' : '新增配置' }}</h3>
        <div class="row">
          <label>配置名称</label>
          <input v-model="form.name" placeholder="如：2026-2027-1 按月统计" />
        </div>
        <div class="row">
          <label>周期类型</label>
          <select v-model="form.periodType">
            <option value="weekly">按周</option>
            <option value="monthly">按月</option>
            <option value="custom">自定义区间</option>
          </select>
        </div>
        <div v-if="form.periodType === 'custom'" class="row">
          <label>起止日期</label>
          <div class="dates">
            <input type="date" v-model="form.startDate" />
            <span>至</span>
            <input type="date" v-model="form.endDate" />
          </div>
        </div>
        <div class="row">
          <label>学年学期</label>
          <input v-model="form.semester" placeholder="如：2026-2027-1（留空为全局）" />
        </div>
        <div class="row">
          <label>启用</label>
          <label class="switch"><input type="checkbox" v-model="form.enabled" /> {{ form.enabled ? '已启用' : '已停用' }}</label>
        </div>
        <div class="btns">
          <button class="save-btn" @click="save">保存</button>
          <button class="cancel-btn" @click="editing = null">取消</button>
        </div>
      </div>

      <div class="table">
        <div class="t-head">
          <span>配置名称</span><span>周期类型</span><span>起止日期</span><span>学年学期</span><span>状态</span><span>操作</span>
        </div>
        <div v-for="cfg in list" :key="cfg.id" class="t-row">
          <span><b>{{ cfg.name }}</b></span>
          <span>{{ TYPE_LABEL[cfg.period_type] || cfg.period_type }}</span>
          <span class="dim">{{ cfg.period_type === 'custom' ? `${cfg.start_date} ~ ${cfg.end_date}` : '-' }}</span>
          <span class="dim">{{ cfg.semester || '全局' }}</span>
          <span><i class="dot" :class="{ on: cfg.enabled }"></i>{{ cfg.enabled ? '启用' : '停用' }}</span>
          <span class="ops">
            <button @click="openEdit(cfg)">编辑</button>
            <button @click="toggle(cfg)">{{ cfg.enabled ? '停用' : '启用' }}</button>
            <button class="del" @click="remove(cfg)">删除</button>
          </span>
        </div>
        <div v-if="list.length === 0" class="empty">暂无配置</div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; min-height: 100vh; background: #f8fafc; }
header { display: flex; align-items: center; padding: 0 32px; height: 56px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.brand { font-size: 16px; font-weight: 600; margin-left: 8px; }
.role { color: #2563eb; }
.back { border: none; background: none; font-size: 18px; cursor: pointer; color: #2563eb; }
main { max-width: 960px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.bar { margin: 0 0 14px; }
.add-btn { padding: 8px 18px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.form-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
.form-card h3 { margin: 0 0 12px; font-size: 16px; }
.row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.row label { width: 90px; font-size: 13px; color: #374151; }
.row input, .row select { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
.dates { display: flex; align-items: center; gap: 8px; flex: 1; }
.dates input { flex: 1; }
.switch { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.btns { display: flex; gap: 10px; justify-content: flex-end; }
.save-btn { padding: 8px 20px; background: #2563eb; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
.cancel-btn { padding: 8px 20px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; }
.table { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
.t-head, .t-row { display: grid; grid-template-columns: 2fr 1fr 1.5fr 1.2fr 0.8fr 1.6fr; gap: 8px; padding: 12px 16px; align-items: center; }
.t-head { background: #f1f5f9; font-size: 13px; color: #475569; font-weight: 600; }
.t-row { border-top: 1px solid #f1f5f9; font-size: 14px; }
.dim { color: #6b7280; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; margin-right: 6px; }
.dot.on { background: #22c55e; }
.ops button { margin-right: 6px; padding: 4px 10px; font-size: 12px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer; }
.ops .del { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.empty { padding: 24px; text-align: center; color: #9ca3af; font-size: 14px; }
@media (max-width: 768px) {
  .t-head, .t-row { grid-template-columns: 1fr 1fr; }
  .t-head span:nth-child(n+3) { display: none; }
  .t-row .dim, .t-row .dot + span, .t-row .ops { grid-column: auto; }
}
</style>
