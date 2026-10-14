<script setup>
// 管理端-成绩管理：选择课程 → 总成绩榜/作业/期末（行内修改必填原因，留痕）+ 变更留痕
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import { getCourses } from '../../api/course'
import { getCourseScores, updateScore, getScoreChanges } from '../../api/score'
import { getFinalScores as getFinal } from '../../api/exam'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const courses = ref([])
const courseId = ref(Number(route.query.courseId) || null)
const tab = ref('final')
const finalData = ref(null)
const scoreData = ref(null)
const changes = ref([])
const message = ref('')
const saving = ref(false)
const edit = ref(null)
const reason = ref('')

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function statusText(r) {
  if (r.exempt) return '已豁免'
  if (r.status === 'graded') return '已批改'
  if (r.status === 'returned') return '已打回'
  if (r.status === 'submitted') return '待批改'
  return '未提交'
}

async function fetchCourses() {
  try {
    const res = await getCourses()
    courses.value = res.data.list
  } catch (e) {
    message.value = e.message
  }
}

async function loadAll() {
  if (!courseId.value) return
  try {
    const [finalRes, scoreRes, changeRes] = await Promise.all([
      getFinal(courseId.value),
      getCourseScores(courseId.value),
      getScoreChanges(courseId.value),
    ])
    finalData.value = finalRes.data
    scoreData.value = scoreRes.data
    changes.value = changeRes.data.list
  } catch (e) {
    message.value = e.message
  }
}

function selectCourse(id) {
  courseId.value = Number(id)
  router.replace({ path: '/admin/scores', query: { courseId: courseId.value } })
  loadAll()
}

function openEdit(type, refId, row, maxScore) {
  edit.value = {
    type,
    refId,
    studentId: row.student_id,
    studentName: row.name,
    oldScore: row.score,
    score: row.score == null ? '' : String(row.score),
    maxScore,
  }
  reason.value = ''
}

async function saveEdit() {
  if (!edit.value) return
  if (edit.value.score === '' || edit.value.score == null) {
    message.value = '请填写成绩'
    return
  }
  if (!reason.value.trim()) {
    message.value = '修改成绩必须填写原因'
    return
  }
  saving.value = true
  try {
    const res = await updateScore(courseId.value, edit.value.type, {
      studentId: edit.value.studentId,
      score: Number(edit.value.score),
      reason: reason.value.trim(),
      refId: edit.value.refId,
    })
    message.value = res.message
    edit.value = null
    await loadAll()
  } catch (e) {
    message.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await fetchCourses()
  if (courseId.value) await loadAll()
})

function goBack() { if (window.history.length > 1) router.back(); else router.push('/admin') }
</script>

<template>
  <div class="page">
    <header>
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">管理端</span></div>
      <div class="user">
        <span>欢迎，{{ userStore.user?.name }}管理员</span>
        <button @click="userStore.logout(); router.push('/login')">退出</button>
      </div>
    </header>
    <main>
      <h2>成绩管理</h2>
      <p class="tip">选择课程查看总成绩榜与各次成绩明细；修改作业/期末成绩须填写原因（留痕可追溯）</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <div class="course-bar">
        <span class="sec-label">选择课程：</span>
        <button
          v-for="c in courses"
          :key="c.id"
          class="chip"
          :class="{ active: Number(c.id) === Number(courseId) }"
          @click="selectCourse(c.id)"
        >{{ c.name }}</button>
        <span v-if="courses.length === 0" class="empty-inline">暂无课程</span>
      </div>

      <template v-if="courseId">
        <div class="tabs">
          <button class="tab" :class="{ on: tab === 'final' }" @click="tab = 'final'">总成绩榜</button>
          <button class="tab" :class="{ on: tab === 'homework' }" @click="tab = 'homework'">作业成绩</button>
          <button class="tab" :class="{ on: tab === 'exam' }" @click="tab = 'exam'">期末成绩</button>
          <button class="tab" :class="{ on: tab === 'changes' }" @click="tab = 'changes'">变更留痕</button>
        </div>

        <template v-if="tab === 'final' && finalData">
          <div class="head-block">
            <h3>加权总成绩（签到 {{ finalData.weights.checkinWeight }}% + 作业 {{ finalData.weights.homeworkWeight }}% + 期末 {{ finalData.weights.examWeight }}%）</h3>
            <p class="meta">应到会话 {{ finalData.sessionCount }} 次 · 非豁免作业 {{ finalData.homeworkCount }} 次 · 考试 {{ finalData.examCount }} 门</p>
          </div>
          <div class="table-box">
            <div class="t-head">
              <span>排名</span><span>学生</span><span>签到</span><span>作业</span><span>期末</span><span>总成绩</span>
            </div>
            <div v-for="row in finalData.list" :key="row.student_id" class="t-row">
              <span class="rank">{{ row.rank ?? '-' }}</span>
              <span class="c-name">{{ row.name }}（{{ row.username }}）</span>
              <span>{{ row.checkinScore }}</span>
              <span>{{ row.homeworkScore }}</span>
              <span>{{ row.examScore ?? '-' }}</span>
              <span class="final-val">{{ row.final ?? '-' }}</span>
            </div>
            <div v-if="finalData.list.length === 0" class="empty">该课程暂无学生</div>
          </div>
        </template>

        <template v-else-if="tab === 'homework' && scoreData">
          <div v-if="scoreData.homeworks.length === 0" class="empty">还没有作业</div>
          <div v-for="hw in scoreData.homeworks" :key="hw.id" class="table-box">
            <h3>{{ hw.name }}</h3>
            <div class="t-head hw-head">
              <span>学生</span><span>得分</span><span>状态</span><span></span>
            </div>
            <div v-for="row in hw.rows" :key="row.student_id" class="t-row">
              <span class="c-name">{{ row.name }}（{{ row.username }}）</span>
              <span>{{ row.score ?? '-' }}</span>
              <span class="st" :class="{ exempt: row.exempt }">{{ statusText(row) }}</span>
              <span class="op">
                <button class="link-btn" @click="openEdit('homework', hw.id, row, 100)">修改</button>
              </span>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'exam' && scoreData">
          <div v-if="scoreData.exams.length === 0" class="empty">还没有期末考试</div>
          <div v-for="ex in scoreData.exams" :key="ex.id" class="table-box">
            <h3>{{ ex.name }}（满分 {{ ex.fullScore }}）</h3>
            <div class="t-head hw-head">
              <span>学生</span><span>得分</span><span>来源</span><span></span>
            </div>
            <div v-for="row in ex.rows" :key="row.student_id" class="t-row">
              <span class="c-name">{{ row.name }}（{{ row.username }}）</span>
              <span>{{ row.score ?? '-' }}</span>
              <span class="st" :class="{ wait: row.source === 'student' }">{{ row.source === 'student' ? '学生提交' : row.score == null ? '未录入' : '已确认' }}</span>
              <span class="op">
                <button class="link-btn" @click="openEdit('exam', ex.id, row, ex.fullScore)">修改</button>
              </span>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'changes'">
          <div v-if="changes.length === 0" class="empty">暂无成绩变更记录</div>
          <div class="table-box">
            <div class="t-head ch-head">
              <span>时间</span><span>项目</span><span>学生</span><span>旧值</span><span>新值</span><span>原因</span><span>操作人</span>
            </div>
            <div v-for="c in changes" :key="c.id" class="t-row">
              <span class="dim">{{ fmtTime(c.createdAt) }}</span>
              <span>{{ c.itemType === 'homework' ? '作业' : '期末' }} · {{ c.refName }}</span>
              <span class="c-name">{{ c.studentName }}</span>
              <span>{{ c.oldScore ?? '-' }}</span>
              <span class="final-val">{{ c.newScore }}</span>
              <span class="reason">{{ c.reason }}</span>
              <span>{{ c.operatorName }}</span>
            </div>
          </div>
        </template>
      </template>
      <div v-else class="empty">请先选择课程</div>

      <!-- 修改弹窗 -->
      <div v-if="edit" class="modal-mask" @click.self="edit = null">
        <div class="modal">
          <div class="modal-head">
            <b>修改成绩 · {{ edit.studentName }}</b>
            <button class="modal-close" @click="edit = null">✕</button>
          </div>
          <div class="modal-body">
            <label>原成绩：<b>{{ edit.oldScore ?? '未录入' }}</b></label>
            <label>新成绩（0-{{ edit.maxScore }}）
              <input v-model.number="edit.score" class="input" type="number" :min="0" :max="edit.maxScore" step="0.5" />
            </label>
            <label>修改原因 *
              <input v-model="reason" class="input" placeholder="如：复核卷面发现漏分" />
            </label>
            <div class="actions">
              <button class="primary" :disabled="saving" @click="saveEdit">{{ saving ? '保存中...' : '保存' }}</button>
              <button class="ghost" @click="edit = null">取消</button>
            </div>
          </div>
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
.user { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #374151; }
.user button {
  padding: 6px 14px; background: #fff; color: #dc2626;
  border: 1px solid #fca5a5; border-radius: 6px; cursor: pointer; font-size: 13px;
}
main { max-width: 1120px; margin: 0 auto; padding: 28px 20px; }
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
.empty-inline { color: #9ca3af; font-size: 13px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.tab {
  padding: 7px 16px; border: 1px solid #d1d5db; background: #fff; border-radius: 20px;
  font-size: 13px; cursor: pointer; color: #6b7280;
}
.tab.on { background: #2563eb; color: #fff; border-color: #2563eb; }
.head-block { margin-bottom: 14px; }
.head-block h3 { margin: 0 0 6px; font-size: 17px; }
.meta { color: #6b7280; font-size: 12px; margin: 0; }
.table-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.table-box h3 { margin: 0 0 10px; font-size: 15px; }
.t-head, .t-row {
  display: grid; align-items: center; gap: 10px;
  padding: 8px 10px; font-size: 13px;
}
.t-head { background: #f8fafc; color: #6b7280; font-weight: 600; border-radius: 8px; grid-template-columns: 60px 1fr 70px 70px 70px 90px; }
.t-row { border-top: 1px solid #f1f5f9; grid-template-columns: 60px 1fr 70px 70px 70px 90px; }
.hw-head, .hw-head + .t-row { grid-template-columns: 1fr 70px 100px 70px; }
.ch-head, .ch-head + .t-row { grid-template-columns: 150px 1fr 90px 60px 60px 1fr 80px; }
.rank { color: #2563eb; font-weight: 600; }
.c-name { color: #374151; }
.final-val { font-weight: 700; color: #1e293b; }
.st { font-size: 12px; color: #6b7280; }
.st.exempt { color: #b45309; }
.st.wait { color: #b45309; }
.op { text-align: right; }
.link-btn {
  background: none; border: 1px solid #d1d5db; color: #2563eb;
  border-radius: 6px; padding: 4px 14px; font-size: 12px; cursor: pointer;
}
.reason { color: #374151; font-size: 12px; }
.dim { color: #9ca3af; font-size: 12px; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }
.modal-mask {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal { background: #fff; border-radius: 14px; width: 420px; max-width: 90vw; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2); }
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid #e5e7eb; font-size: 15px;
}
.modal-close { background: none; border: none; font-size: 15px; cursor: pointer; color: #6b7280; }
.modal-body { padding: 16px 18px; display: grid; gap: 12px; }
.modal-body label { display: grid; gap: 6px; font-size: 13px; color: #374151; }
.input {
  padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 13px; font-family: inherit;
}
.actions { display: flex; gap: 10px; margin-top: 4px; }
.primary {
  padding: 9px 18px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.ghost {
  padding: 8px 14px; background: #fff; color: #374151; border: 1px solid #d1d5db;
  border-radius: 8px; font-size: 13px; cursor: pointer;
}
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
}
.back:hover { background: #f8fafc; }
</style>
