<script setup>
const router = useRouter()
// 学生端-我的成绩：学分加权总成绩 + 所有课程列表（课程名/学分/成绩）→ 点击行弹窗查看该课程成绩详情（只读）
import { onMounted, ref } from 'vue'
import { getCourses } from '../../api/course'
import { getMyScores } from '../../api/score'
import { getFinalScores } from '../../api/exam'
import { useRouter } from 'vue-router'

const courses = ref([])
const message = ref('')
const loading = ref(true)

// 汇总
const weightedAvg = ref(null)
const avgRank = ref(null)   // 平均名次（已出成绩课程）
const avgTotal = ref(null)  // 平均班级人数（已出成绩课程）
const gradedCount = ref(0)
const totalCredit = ref(0)

// 弹窗
const showModal = ref(false)
const modal = ref(null) // { courseName, credit, finalData, myData }

const STATUS_TEXT = { submitted: '待批改', graded: '已批改', returned: '已打回', none: '未提交' }

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { hour12: false })
}

function round1(v) {
  return v == null ? null : Math.round(v * 10) / 10
}

async function loadCourses() {
  loading.value = true
  try {
    const res = await getCourses()
    courses.value = res.data.list

    // 并行拉取每门课的总成绩（拿 me 的成绩与排名）
    const finals = await Promise.all(
      courses.value.map((c) =>
        getFinalScores(c.id)
          .then((r) => ({ course: c, data: r.data }))
          .catch(() => ({ course: c, data: null }))
      )
    )
    let sumWeighted = 0
    let sumCredit = 0
    let graded = 0
    let rankSum = 0
    let totalSum = 0
    finals.forEach(({ course, data }) => {
      const me = data?.me
      const finalScore = me && me.final != null ? Number(me.final) : null
      course._final = finalScore
      course._rank = me && me.rank != null ? me.rank : null
      course._weights = data?.weights || null
      course._totalStudents = data?.list ? data.list.length : 0
      if (finalScore != null) {
        sumWeighted += finalScore * Number(course.credit)
        sumCredit += Number(course.credit)
        graded += 1
        if (course._rank != null && course._totalStudents > 0) {
          rankSum += course._rank
          totalSum += course._totalStudents
        }
      }
    })
    gradedCount.value = graded
    totalCredit.value = sumCredit
    weightedAvg.value = sumCredit > 0 ? round1(sumWeighted / sumCredit) : null
    avgRank.value = graded > 0 && totalSum > 0 ? Math.round(rankSum / graded) : null
    avgTotal.value = graded > 0 && totalSum > 0 ? Math.round(totalSum / graded) : null
    // 排序：已出分课程在前（原顺序），未出分课程按开设时间（createdAt 升序）排在后面
    const gradedCourses = courses.value.filter((c2) => c2._final != null)
    const pendingCourses = courses.value
      .filter((c2) => c2._final == null)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    courses.value = [...gradedCourses, ...pendingCourses]
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

async function openDetail(course) {
  try {
    const [mRes, fRes] = await Promise.all([getMyScores(course.id), getFinalScores(course.id)])
    modal.value = {
      courseName: course.name,
      credit: course.credit,
      finalData: fRes.data,
      myData: mRes.data,
    }
    showModal.value = true
  } catch (e) {
    message.value = e.message
  }
}

onMounted(loadCourses)

function goBack() { if (window.history.length > 1) router.back(); else router.push('/student') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">学生端</span></div>
      
    </header>
    <main>
      <h2>我的成绩</h2>
      <p class="tip">学分加权总成绩汇总 + 各课程成绩（只读）</p>
      <p v-if="message" class="msg">{{ message }}</p>

      <!-- 学分加权总成绩 + 排名 -->
      <div class="weighted-card">
        <div class="wc-col">
          <div class="wc-label">加权成绩</div>
          <div class="wc-value">{{ weightedAvg ?? '-' }}</div>
          <div class="wc-sub">已出成绩 {{ gradedCount }} 门 · 参与加权学分 {{ totalCredit }}</div>
        </div>
        <div class="wc-divider"></div>
        <div class="wc-col">
          <div class="wc-label">班级排名</div>
          <div class="wc-value">{{ avgRank != null ? avgRank + ' / ' + avgTotal : '-' }}</div>
          <div class="wc-sub">已出成绩课程的平均名次</div>
        </div>
      </div>

      <!-- 课程列表 -->
      <div class="course-table">
        <div class="ct-head">
          <span>课程名</span><span>学分</span><span>成绩</span>
        </div>
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="courses.length === 0" class="empty">还没有加入任何课程</div>
        <div
          v-for="c in courses"
          :key="c.id"
          class="ct-row"
          @click="openDetail(c)"
        >
          <span class="c-name">{{ c.name }}</span>
          <span>{{ c.credit }}</span>
          <span class="c-score" :class="{ done: c._final != null }">
            {{ c._final != null ? c._final : '待上传' }}
          </span>
        </div>
      </div>

      <!-- 课程成绩详情弹窗（复用成绩明细逻辑） -->
      <div v-if="showModal && modal" class="modal-mask" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-head">
            <b>{{ modal.courseName }}（{{ modal.credit }} 学分）</b>
            <button class="modal-close" @click="showModal = false">✕</button>
          </div>
          <div class="modal-body">
            <!-- 总成绩 -->
            <div class="card">
              <h3>加权总成绩
                <span v-if="modal.finalData.me" class="rank-tag">第 {{ modal.finalData.me.rank }} 名</span>
              </h3>
              <p class="meta">权重：签到 {{ modal.finalData.weights.checkinWeight }}% · 作业 {{ modal.finalData.weights.homeworkWeight }}% · 期末 {{ modal.finalData.weights.examWeight }}%</p>
              <div v-if="modal.finalData.me" class="stats">
                <div class="stat"><b>{{ modal.finalData.me.checkinScore }}</b><span>签到</span></div>
                <div class="stat"><b>{{ modal.finalData.me.homeworkScore }}</b><span>作业</span></div>
                <div class="stat"><b>{{ modal.finalData.me.examScore ?? '-' }}</b><span>期末</span></div>
                <div class="stat main"><b>{{ modal.finalData.me.final ?? '-' }}</b><span>总成绩</span></div>
              </div>
              <p v-else class="dim">暂无总成绩（等待期末成绩录入）</p>
            </div>

            <!-- 签到 -->
            <div class="card">
              <h3>签到成绩 <span class="sub">{{ modal.myData.checkin.score }} 分</span></h3>
              <p class="meta">出勤 {{ modal.myData.checkin.presentCount }} / {{ modal.myData.checkin.sessionCount }} 次（正常签到与补签计入，缺勤不计）</p>
            </div>

            <!-- 作业 -->
            <div class="card">
              <h3>随堂作业</h3>
              <div v-if="modal.myData.homeworks.length === 0" class="dim">暂无作业</div>
              <div v-for="h in modal.myData.homeworks" :key="h.id" class="row">
                <span class="row-name">{{ h.name }}</span>
                <span v-if="h.exempt" class="tag t-exempt">已豁免</span>
                <span v-else-if="h.score != null" class="tag t-done">{{ h.score }} 分</span>
                <span v-else class="tag t-none">{{ STATUS_TEXT[h.status] }}</span>
              </div>
            </div>

            <!-- 调查 -->
            <div class="card">
              <h3>学情调查参与</h3>
              <p class="meta">已参与 {{ modal.myData.surveys.participated }} / {{ modal.myData.surveys.total }} 次调查</p>
            </div>

            <!-- 期末 -->
            <div class="card">
              <h3>期末考试</h3>
              <div v-if="modal.myData.exams.length === 0" class="dim">暂无考试</div>
              <div v-for="e in modal.myData.exams" :key="e.id" class="row">
                <span class="row-name">{{ e.name }}（{{ e.form === 'online' ? '线上' : '线下' }} · 满分 {{ e.fullScore }}）</span>
                <span v-if="e.score != null" class="tag" :class="e.source === 'student' ? 't-wait' : 't-done'">
                  {{ e.score }} 分{{ e.source === 'student' ? '（待确认）' : '' }}
                </span>
                <span v-else class="tag t-none">未录入</span>
              </div>
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
.back a { color: #2563eb; font-size: 14px; text-decoration: none; }
main { max-width: 900px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }

.weighted-card {
  background: linear-gradient(135deg, #1e40af, #2563eb);
  border-radius: 16px; padding: 22px 24px; color: #fff;
  display: flex; align-items: stretch;
  margin-bottom: 16px;
}
.wc-col { flex: 1; }
.wc-col + .wc-col { text-align: right; }
.wc-divider {
  width: 1px; background: rgba(255, 255, 255, 0.3); margin: 0 28px;
}
.wc-label { font-size: 13px; opacity: 0.85; }
.wc-value { font-size: 44px; font-weight: 700; line-height: 1.1; margin: 4px 0 2px; }
.wc-sub { font-size: 12px; opacity: 0.85; }

.course-table { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
.ct-head, .ct-row {
  display: grid; grid-template-columns: 1fr 100px 140px; gap: 10px;
  align-items: center; padding: 13px 18px; font-size: 14px;
}
.ct-head { background: #f8fafc; color: #6b7280; font-weight: 600; font-size: 13px; }
.ct-row { border-top: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; }
.ct-row:hover { background: #eff6ff; }
.c-name { font-weight: 600; color: #1e293b; }
.c-score { font-weight: 700; color: #9ca3af; }
.c-score.done { color: #2563eb; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: #f8fafc; border-radius: 14px; width: 640px; max-width: 94vw;
  max-height: 84vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 20px; border-bottom: 1px solid #e5e7eb; background: #fff;
  border-radius: 14px 14px 0 0; font-size: 15px;
}
.modal-close { background: none; border: none; font-size: 15px; cursor: pointer; color: #6b7280; }
.modal-body { padding: 16px 20px; overflow-y: auto; }

.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
.card h3 { margin: 0 0 8px; font-size: 15px; display: flex; align-items: center; gap: 10px; }
.sub { font-size: 13px; color: #2563eb; font-weight: 600; }
.meta { color: #6b7280; font-size: 12px; margin: 0 0 8px; }
.rank-tag {
  background: #2563eb; color: #fff; font-size: 12px; padding: 3px 12px; border-radius: 20px; font-weight: 500;
}
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.stat { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 8px; text-align: center; }
.stat.main { background: #eff6ff; border-color: #bfdbfe; }
.stat b { font-size: 20px; display: block; color: #1e293b; }
.stat span { font-size: 11px; color: #6b7280; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.row:last-child { border-bottom: none; }
.row-name { color: #374151; }
.tag { font-size: 12px; padding: 3px 12px; border-radius: 20px; font-weight: 500; }
.t-done { background: #dcfce7; color: #15803d; }
.t-wait { background: #fef3c7; color: #92400e; }
.t-none { background: #f3f4f6; color: #6b7280; }
.t-exempt { background: #fef3c7; color: #92400e; }
.dim { color: #9ca3af; font-size: 13px; }
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
  .card { padding: 12px 14px; }
  .modal { width: 94vw; max-width: 94vw; }
  .course-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .stats { grid-template-columns: 1fr 1fr; }
}
</style>
