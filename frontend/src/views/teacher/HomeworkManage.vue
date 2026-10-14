<script setup>
const router = useRouter()
// 教师端-随堂作业：发布作业（截止时间/格式要求）→ 学生提交列表（状态/逾期/豁免）→ 在线批改/打回/豁免
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createHomework,
  getHomeworks,
  getHomework,
  updateHomework,
  deleteHomework,
  gradeHomework,
  returnHomework,
  exemptHomework,
} from '../../api/homework'

const route = useRoute()
const courseId = route.params.id

const homeworks = ref([])
const detail = ref(null)
const selected = ref(null)
const message = ref('')
const loading = ref(false)

// 发布/编辑表单
const showForm = ref(false)
const editingId = ref(null)
const form = ref({ title: '', description: '', deadline: '', formatTypes: 'text', maxSizeMB: 5 })

// 批改弹窗
const gradeModal = ref({ show: false, row: null, score: null, comment: '' })

// 豁免原因弹窗
const exemptModal = ref({ show: false, row: null, reason: '' })

const STATUS_TEXT = { submitted: '已提交（待批改）', graded: '已批改', returned: '打回重交' }

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function fmtDeadlineInput(t) {
  if (!t) return ''
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

async function loadList() {
  loading.value = true
  try {
    const res = await getHomeworks(courseId)
    homeworks.value = res.data.list
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

async function openDetail(hw) {
  selected.value = hw
  detail.value = null
  try {
    const res = await getHomework(hw.id)
    detail.value = res.data
  } catch (e) {
    message.value = e.message
  }
}

function openCreate() {
  editingId.value = null
  form.value = { title: '', description: '', deadline: '', formatTypes: 'text', maxSizeMB: 5 }
  showForm.value = true
}

function openEdit() {
  const hw = selected.value
  if (!hw) return
  editingId.value = hw.id
  const rules = hw.formatRules || {}
  form.value = {
    title: hw.title,
    description: hw.description || '',
    deadline: fmtDeadlineInput(hw.deadline),
    formatTypes: (rules.types || ['text'])[0],
    maxSizeMB: rules.maxSizeMB || 5,
  }
  showForm.value = true
}

async function saveForm() {
  if (!form.value.title.trim()) {
    message.value = '请填写作业标题'
    return
  }
  if (!form.value.deadline) {
    message.value = '请设置提交截止时间'
    return
  }
  const data = {
    title: form.value.title.trim(),
    description: form.value.description,
    deadline: form.value.deadline,
    formatRules: { types: [form.value.formatTypes], maxSizeMB: Number(form.value.maxSizeMB) || 5 },
  }
  try {
    if (editingId.value) {
      await updateHomework(editingId.value, data)
      message.value = '作业已更新'
    } else {
      await createHomework(courseId, data)
      message.value = '作业发布成功'
    }
    showForm.value = false
    await loadList()
    if (selected.value) {
      await openDetail(selected.value)
    }
  } catch (e) {
    message.value = e.message
  }
}

async function removeHomework() {
  if (!selected.value) return
  if (!confirm(`确定删除作业「${selected.value.title}」？其下所有提交与豁免记录将一并删除。`)) return
  try {
    await deleteHomework(selected.value.id)
    message.value = '作业已删除'
    selected.value = null
    detail.value = null
    await loadList()
  } catch (e) {
    message.value = e.message
  }
}

function openGrade(row) {
  gradeModal.value = { show: true, row, score: row.submission?.score ?? '', comment: row.submission?.comment || '' }
}

async function doGrade() {
  const m = gradeModal.value
  if (m.score === '' || m.score === null || Number(m.score) < 0 || Number(m.score) > 100) {
    message.value = '分数需在 0-100 之间'
    return
  }
  try {
    await gradeHomework(selected.value.id, { studentId: m.row.studentId, score: Number(m.score), comment: m.comment })
    message.value = '批改完成'
    gradeModal.value.show = false
    await openDetail(selected.value)
  } catch (e) {
    message.value = e.message
  }
}

async function doReturn(row) {
  const comment = prompt('请输入打回说明（学生将看到）：', '内容不完整，请补充后重新提交')
  if (comment === null) return
  try {
    await returnHomework(selected.value.id, { studentId: row.studentId, comment })
    message.value = '已打回，学生可修改后重新提交'
    await openDetail(selected.value)
  } catch (e) {
    message.value = e.message
  }
}

function openExempt(row) {
  exemptModal.value = { show: true, row, reason: row.exemptReason || '' }
}

async function doExempt() {
  const m = exemptModal.value
  try {
    await exemptHomework(selected.value.id, {
      studentId: m.row.studentId,
      exempt: !m.row.exempt,
      reason: m.reason,
    })
    message.value = m.row.exempt ? '已取消豁免' : '已豁免该学生（不计入作业平均分）'
    exemptModal.value.show = false
    await openDetail(selected.value)
  } catch (e) {
    message.value = e.message
  }
}

let pollTimer = null

onMounted(() => {
  loadList()
  // 实时感知学生提交的新作业
  pollTimer = setInterval(loadList, 1000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/teacher/courses/${courseId}`) }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      
    </header>
    <main>
      <h2>随堂作业</h2>
      <p class="tip">发布作业并设置截止时间/格式 → 学生提交 → 在线批改/打回/豁免（被豁免作业不计入作业平均分）</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <button class="primary" @click="openCreate">📝 发布随堂作业</button>

      <div v-if="showForm" class="form-card">
        <h3>{{ editingId ? '编辑作业' : '发布作业' }}</h3>
        <label>作业标题 *<input v-model="form.title" class="input" placeholder="如：作业1-需求分析用例图" /></label>
        <label>作业描述<textarea v-model="form.description" class="input" rows="3" placeholder="作业要求说明"></textarea></label>
        <label>提交截止时间 *<input v-model="form.deadline" class="input" type="datetime-local" /></label>
        <div class="row-2">
          <label>提交格式
            <select v-model="form.formatTypes" class="input">
              <option value="text">文本</option>
              <option value="image">图片</option>
              <option value="attachment">附件</option>
              <option value="text_image">文本+图片</option>
              <option value="text_attachment">文本+附件</option>
            </select>
          </label>
          <label>附件大小上限（MB）<input v-model.number="form.maxSizeMB" class="input" type="number" min="1" max="50" /></label>
        </div>
        <div class="actions">
          <button class="primary" @click="saveForm">{{ editingId ? '保存修改' : '发布' }}</button>
          <button class="ghost" @click="showForm = false">取消</button>
        </div>
      </div>

      <div class="cols">
        <!-- 左：作业列表 -->
        <div class="col list-col">
          <div v-if="homeworks.length === 0 && !loading" class="empty">还没有作业，请先发布</div>
          <div
            v-for="hw in homeworks"
            :key="hw.id"
            class="hw-card"
            :class="{ active: selected?.id === hw.id }"
            @click="openDetail(hw)"
          >
            <div class="hw-title">{{ hw.title }}</div>
            <div class="hw-meta">
              截止 {{ fmtTime(hw.deadline) }}
              <span v-if="hw.isLate" class="tag t-over">已截止</span>
            </div>
            <div class="hw-stats">
              共 {{ hw.stats.studentCount }} 人 · 已交 {{ hw.stats.submittedCount }} · 已批 {{ hw.stats.gradedCount }} · 豁免 {{ hw.stats.exemptCount }}
            </div>
          </div>
        </div>

        <!-- 右：作业详情 -->
        <div class="col detail-col">
          <template v-if="selected && detail">
            <div class="detail-head">
              <div>
                <h3>{{ detail.homework.title }}</h3>
                <p class="desc">{{ detail.homework.description }}</p>
                <p class="meta">截止：{{ fmtTime(detail.homework.deadline) }} · 格式：{{ (detail.homework.formatRules.types || []).join('、') }} · 上限 {{ detail.homework.formatRules.maxSizeMB || '-' }}MB</p>
              </div>
              <div class="head-actions">
                <button class="ghost" @click="openEdit">编辑</button>
                <button class="danger" @click="removeHomework">删除</button>
              </div>
            </div>

            <table class="sub-table">
              <thead>
                <tr>
                  <th>学生</th>
                  <th>状态</th>
                  <th>提交时间</th>
                  <th>分数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in detail.rows" :key="row.studentId">
                  <td>
                    {{ row.name }}（{{ row.username }}）
                    <span v-if="row.exempt" class="tag t-exempt">豁免</span>
                  </td>
                  <td>
                    <span v-if="row.exempt" class="tag t-exempt">已豁免</span>
                    <span v-else-if="row.submission" class="tag" :class="row.submission.status === 'graded' ? 't-graded' : row.submission.status === 'returned' ? 't-returned' : 't-submitted'">
                      {{ STATUS_TEXT[row.submission.status] }}
                    </span>
                    <span v-else class="tag t-none">未提交</span>
                  </td>
                  <td>
                    <span v-if="row.submission">
                      {{ fmtTime(row.submission.submittedAt) }}
                      <span v-if="row.submission.late" class="tag t-over">逾期</span>
                    </span>
                    <span v-else>-</span>
                  </td>
                  <td>{{ row.submission?.score ?? '-' }}</td>
                  <td>
                    <template v-if="row.exempt">
                      <button class="mini ghost" @click="openExempt(row)">取消豁免</button>
                    </template>
                    <template v-else-if="row.submission">
                      <button class="mini primary" @click="openGrade(row)">批改</button>
                      <button class="mini ghost" @click="doReturn(row)">打回</button>
                      <button class="mini ghost" @click="openExempt(row)">豁免</button>
                    </template>
                    <template v-else>
                      <button class="mini ghost" @click="openExempt(row)">豁免</button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
          <div v-else class="empty">选择左侧作业查看提交详情</div>
        </div>
      </div>
    </main>

    <!-- 批改弹窗 -->
    <div v-if="gradeModal.show" class="modal-mask" @click.self="gradeModal.show = false">
      <div class="modal-box">
        <div class="modal-head">
          <b>批改：{{ gradeModal.row.name }}（{{ gradeModal.row.username }}）</b>
          <button class="modal-close" @click="gradeModal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="sub-content">
            <b>提交内容：</b>
            <p>{{ gradeModal.row.submission.content || '（无文本内容）' }}</p>
            <p v-if="gradeModal.row.submission.attachment" class="dim">附件：{{ gradeModal.row.submission.attachment.name }}（{{ gradeModal.row.submission.attachment.size }}MB）</p>
          </div>
          <label>分数（0-100）*<input v-model.number="gradeModal.score" class="input" type="number" min="0" max="100" /></label>
          <label>评语<textarea v-model="gradeModal.comment" class="input" rows="3" placeholder="批改评语"></textarea></label>
          <div class="actions">
            <button class="primary" @click="doGrade">确认批改</button>
            <button class="ghost" @click="gradeModal.show = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 豁免弹窗 -->
    <div v-if="exemptModal.show" class="modal-mask" @click.self="exemptModal.show = false">
      <div class="modal-box">
        <div class="modal-head">
          <b>{{ exemptModal.row.exempt ? '取消豁免' : '豁免作业' }}：{{ exemptModal.row.name }}</b>
          <button class="modal-close" @click="exemptModal.show = false">✕</button>
        </div>
        <div class="modal-body">
          <label v-if="!exemptModal.row.exempt">豁免原因（如请假）<input v-model="exemptModal.reason" class="input" placeholder="如：因病请假" /></label>
          <p class="dim">豁免后该学生本次作业不计入作业平均分。</p>
          <div class="actions">
            <button class="primary" @click="doExempt">{{ exemptModal.row.exempt ? '确认取消豁免' : '确认豁免' }}</button>
            <button class="ghost" @click="exemptModal.show = false">取消</button>
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
main { max-width: 1180px; margin: 0 auto; padding: 28px 20px; }
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
.mini { padding: 5px 10px; font-size: 12px; margin-right: 6px; border-radius: 6px; }
.form-card {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;
  padding: 16px 18px; margin: 14px 0; display: grid; gap: 12px;
}
.form-card label { display: grid; gap: 6px; font-size: 13px; color: #374151; }
.input {
  padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; background: #fff; font-family: inherit;
}
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.actions { display: flex; gap: 10px; }
.cols { display: grid; grid-template-columns: 340px 1fr; gap: 16px; margin-top: 16px; align-items: start; }
.list-col { max-height: 70vh; overflow-y: auto; }
.hw-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s;
}
.hw-card:hover { border-color: #93c5fd; }
.hw-card.active { border-color: #2563eb; background: #eff6ff; }
.hw-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.hw-meta { font-size: 12px; color: #6b7280; margin: 6px 0; }
.hw-stats { font-size: 12px; color: #6b7280; }
.detail-col { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; min-height: 300px; }
.detail-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.detail-head h3 { margin: 0 0 6px; font-size: 18px; }
.desc { color: #374151; font-size: 13px; margin: 0 0 6px; }
.meta { color: #6b7280; font-size: 12px; margin: 0; }
.head-actions { display: flex; gap: 8px; align-items: flex-start; }
.sub-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sub-table th {
  text-align: left; background: #f8fafc; padding: 10px 12px; color: #6b7280;
  border-bottom: 1px solid #e5e7eb; font-weight: 600;
}
.sub-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #374151; }
.tag { display: inline-block; font-size: 11px; padding: 2px 10px; border-radius: 20px; font-weight: 500; margin-left: 4px; }
.t-submitted { background: #dbeafe; color: #1d4ed8; }
.t-graded { background: #dcfce7; color: #15803d; }
.t-returned { background: #fef3c7; color: #b45309; }
.t-none { background: #f3f4f6; color: #6b7280; }
.t-over { background: #fee2e2; color: #dc2626; }
.t-exempt { background: #e0e7ff; color: #4338ca; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }
.modal-mask {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  width: 460px; max-width: 90vw; max-height: 80vh; background: #fff; border-radius: 14px;
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
.modal-body { padding: 16px 20px 20px; display: grid; gap: 12px; overflow-y: auto; }
.modal-body label { display: grid; gap: 6px; font-size: 13px; color: #374151; }
.sub-content { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 13px; }
.dim { color: #9ca3af; font-size: 12px; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
