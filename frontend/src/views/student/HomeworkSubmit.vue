<script setup>
const router = useRouter()
// 学生端-我的作业：查看课程作业列表（截止/我的状态/分数/评语）→ 提交/重新提交 → 打回后重交
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getCourses } from '../../api/course'
import { getHomeworks, getHomework, submitHomework } from '../../api/homework'

const route = useRoute()
const courses = ref([])
const currentCourse = ref(null)
const homeworks = ref([])
const detail = ref(null)
const selected = ref(null)
const message = ref('')
const submitting = ref(false)
const content = ref('')
const attachmentName = ref('')

const STATUS_TEXT = { submitted: '已提交（待批改）', graded: '已批改', returned: '已打回，需重交' }

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

async function loadCourses() {
  try {
    const res = await getCourses()
    courses.value = res.data.list
    if (courses.value.length) {
      const q = Number(route.query.courseId)
      const target = q ? courses.value.find((x) => Number(x.id) === q) : null
      currentCourse.value = target ? target.id : courses.value[0].id
      await loadList(currentCourse.value)
    }
  } catch (e) {
    message.value = '加载失败：' + e.message
  }
}

async function loadList(courseId, resetView = true) {
  try {
    const res = await getHomeworks(courseId)
    homeworks.value = res.data.list
    if (resetView) {
      selected.value = null
      detail.value = null
    }
  } catch (e) {
    message.value = e.message
  }
}

function switchCourse(c) {
  currentCourse.value = c.id
  loadList(c.id)
}

async function openDetail(hw) {
  selected.value = hw
  detail.value = null
  content.value = ''
  attachmentName.value = ''
  try {
    const res = await getHomework(hw.id)
    detail.value = res.data
    if (detail.value.mySubmission) {
      content.value = detail.value.mySubmission.content || ''
      attachmentName.value = detail.value.mySubmission.attachment?.name || ''
    }
  } catch (e) {
    message.value = e.message
  }
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const max = detail.value?.homework.formatRules.maxSizeMB || 5
  if (file.size > max * 1024 * 1024) {
    message.value = `附件超过 ${max}MB 上限`
    e.target.value = ''
    attachmentName.value = ''
    return
  }
  attachmentName.value = file.name
}

function canSubmit() {
  if (!detail.value) return false
  if (detail.value.exempt) return false
  if (new Date(detail.value.homework.deadline) < new Date()) return false
  return true
}

function canResubmit() {
  // 打回状态允许重交；已提交/已批改也可覆盖（保留历史）
  return canSubmit()
}

async function doSubmit() {
  if (submitting.value) return
  if (!content.value.trim() && !attachmentName.value) {
    message.value = '请填写提交内容或上传附件'
    return
  }
  submitting.value = true
  try {
    const attachment = attachmentName.value
      ? { name: attachmentName.value, size: 1, type: 'attachment' }
      : null
    const res = await submitHomework(selected.value.id, { content: content.value, attachment })
    message.value = res.message
    await openDetail(selected.value)
  } catch (e) {
    message.value = e.message
  } finally {
    submitting.value = false
  }
}

let pollTimer = null

onMounted(() => {
  loadCourses()
  // 实时感知教师端新发布的作业（不打断正在查看/填写的详情）
  pollTimer = setInterval(() => {
    if (currentCourse.value) loadList(currentCourse.value, false)
  }, 1000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
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
      <h2>我的作业</h2>
      <p class="tip">查看随堂作业，截止时间前按格式要求提交；被打回后可修改重新提交（保留历次提交记录）</p>
      <p v-if="message" class="msg">{{ message }}</p>


      <div class="cols">
        <!-- 左：作业列表 -->
        <div class="col list-col">
          <div v-if="homeworks.length === 0" class="empty">该课程暂无作业</div>
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
            <div class="hw-mine">
              <span v-if="hw.exempt" class="tag t-exempt">已豁免</span>
              <span v-else-if="hw.mySubmission" class="tag" :class="hw.mySubmission.status === 'graded' ? 't-graded' : hw.mySubmission.status === 'returned' ? 't-returned' : 't-submitted'">
                {{ STATUS_TEXT[hw.mySubmission.status] }}{{ hw.mySubmission.score != null ? ' · ' + hw.mySubmission.score + ' 分' : '' }}
              </span>
              <span v-else class="tag t-none">未提交</span>
            </div>
          </div>
        </div>

        <!-- 右：作业详情 -->
        <div class="col detail-col">
          <template v-if="selected && detail">
            <h3>{{ detail.homework.title }}</h3>
            <p class="desc">{{ detail.homework.description }}</p>
            <p class="meta">
              截止：{{ fmtTime(detail.homework.deadline) }} · 格式：{{ (detail.homework.formatRules.types || []).join('、') }} · 上限 {{ detail.homework.formatRules.maxSizeMB || '-' }}MB
            </p>

            <div v-if="detail.exempt" class="notice">本次作业已被教师豁免（不计入作业平均分）</div>

            <template v-else>
              <div v-if="detail.mySubmission" class="my-status">
                <span class="tag" :class="detail.mySubmission.status === 'graded' ? 't-graded' : detail.mySubmission.status === 'returned' ? 't-returned' : 't-submitted'">
                  {{ STATUS_TEXT[detail.mySubmission.status] }}
                </span>
                <span v-if="detail.mySubmission.score != null" class="score">得分：{{ detail.mySubmission.score }} 分</span>
                <span v-if="detail.mySubmission.late" class="tag t-over">逾期提交</span>
                <div v-if="detail.mySubmission.comment" class="comment">教师评语：{{ detail.mySubmission.comment }}</div>
              </div>

              <div v-if="!canSubmit()" class="notice">
                {{ new Date(detail.homework.deadline) < new Date() ? '已过提交截止时间，无法提交' : '本次作业不可提交' }}
              </div>

              <div v-else class="submit-box">
                <label>提交内容（{{ detail.mySubmission ? '修改后重新提交将保留历史记录' : '' }}）
                  <textarea v-model="content" class="input" rows="4" placeholder="填写作业内容"></textarea>
                </label>
                <label>附件（可选）
                  <input class="input" type="file" @change="onFileChange" />
                  <span v-if="attachmentName" class="dim">已选择：{{ attachmentName }}</span>
                </label>
                <button class="primary" :disabled="submitting" @click="doSubmit">
                  {{ submitting ? '提交中...' : detail.mySubmission ? '重新提交' : '提交作业' }}
                </button>
              </div>

              <div v-if="detail.history?.length > 1" class="history">
                <h4>历次提交记录</h4>
                <div v-for="h in detail.history" :key="h.id" class="his-row">
                  <span>{{ fmtTime(h.submittedAt) }}</span>
                  <span class="tag" :class="h.status === 'graded' ? 't-graded' : h.status === 'returned' ? 't-returned' : 't-submitted'">{{ STATUS_TEXT[h.status] }}</span>
                  <span v-if="h.score != null">得分 {{ h.score }}</span>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
      <DanmakuPanel v-if="currentCourse" :course-id="currentCourse" source="homework" :ref-id="selected ? selected.id : null" label="课堂讨论 · 随堂作业" class="dm-panel" />
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
main { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.course-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.sec-label { font-size: 13px; color: #6b7280; }
.chip {
  padding: 6px 14px; border: 1px solid #d1d5db; background: #fff; border-radius: 20px;
  font-size: 13px; cursor: pointer;
}
.chip.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.cols { display: grid; grid-template-columns: 340px 1fr; gap: 16px; align-items: start; }
.list-col { max-height: 72vh; overflow-y: auto; }
.hw-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s;
}
.hw-card:hover { border-color: #93c5fd; }
.hw-card.active { border-color: #2563eb; background: #eff6ff; }
.hw-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.hw-meta { font-size: 12px; color: #6b7280; margin: 6px 0; }
.hw-mine { font-size: 12px; }
.detail-col { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; min-height: 300px; }
.detail-col h3 { margin: 0 0 6px; font-size: 18px; }
.desc { color: #374151; font-size: 13px; margin: 0 0 6px; }
.meta { color: #6b7280; font-size: 12px; margin: 0 0 14px; }
.tag { display: inline-block; font-size: 11px; padding: 2px 10px; border-radius: 20px; font-weight: 500; }
.t-submitted { background: #dbeafe; color: #1d4ed8; }
.t-graded { background: #dcfce7; color: #15803d; }
.t-returned { background: #fef3c7; color: #b45309; }
.t-none { background: #f3f4f6; color: #6b7280; }
.t-over { background: #fee2e2; color: #dc2626; }
.t-exempt { background: #e0e7ff; color: #4338ca; }
.notice { background: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 14px; color: #92400e; font-size: 13px; margin: 12px 0; }
.submit-box { display: grid; gap: 12px; margin-top: 14px; }
.submit-box label { display: grid; gap: 6px; font-size: 13px; color: #374151; }
.input {
  padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; background: #fff; font-family: inherit;
}
.primary {
  padding: 10px 18px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.my-status { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
.score { font-size: 15px; font-weight: 600; color: #15803d; }
.comment { width: 100%; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #374151; }
.history { margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
.history h4 { font-size: 13px; color: #6b7280; margin: 0 0 8px; }
.his-row { display: flex; gap: 12px; align-items: center; font-size: 12px; color: #374151; padding: 6px 0; border-bottom: 1px solid #f8fafc; }
.dim { color: #9ca3af; font-size: 12px; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }
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
  .cols { grid-template-columns: 1fr; }
  .list-col { max-height: none; }
  .course-bar { overflow-x: auto; }
}
</style>
