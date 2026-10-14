<script setup>
const router = useRouter()
// 教师端-课程学情报告：总体统计 + ECharts 可视化（成绩分布/签到趋势/作业平均）+ 每个学生明细与排名
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { getCourseReport, exportCourseReport } from '../../api/report'
import { getCourses } from '../../api/course'
import { useRouter } from 'vue-router'

const route = useRoute()
const courseId = ref(route.params.id || '')
const courses = ref([])
const semester = ref('')
const report = ref(null)
const message = ref('')
const loading = ref(true)
const selected = ref(null)
let charts = []

const semesters = computed(() => [...new Set(courses.value.map((c) => c.semester).filter(Boolean))])
const filteredCourses = computed(() => (semester.value ? courses.value.filter((c) => c.semester === semester.value) : courses.value))

function renderCharts() {
  charts.forEach((c) => c.dispose())
  charts = []
  const o = report.value.overall
  const theme = { blue: '#2563eb', light: '#93c5fd', gray: '#9ca3af' }

  // 1) 总成绩分布
  const distEl = document.getElementById('chart-dist')
  if (distEl) {
    const chart = echarts.init(distEl)
    chart.setOption({
      title: { text: '总成绩分布', left: 'center', textStyle: { fontSize: 14, color: '#1e293b' } },
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 46, bottom: 28 },
      xAxis: { type: 'category', data: o.gradeDist.map((d) => d.range), axisLabel: { fontSize: 12 } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 12 } },
      series: [
        {
          type: 'bar',
          data: o.gradeDist.map((d) => d.count),
          barWidth: 40,
          itemStyle: { color: theme.blue, borderRadius: [6, 6, 0, 0] },
          label: { show: true, position: 'top', fontSize: 12 },
        },
      ],
    })
    charts.push(chart)
  }

  // 2) 签到出勤率趋势
  const trendEl = document.getElementById('chart-trend')
  if (trendEl) {
    const chart = echarts.init(trendEl)
    chart.setOption({
      title: { text: '各次课堂出勤率趋势', left: 'center', textStyle: { fontSize: 14, color: '#1e293b' } },
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 46, bottom: 28 },
      xAxis: { type: 'category', data: o.checkinTrend.map((t) => `第${t.sessionId}次`) },
      yAxis: { type: 'value', max: 100, axisLabel: { fontSize: 12, formatter: '{value}%' } },
      series: [
        {
          type: 'line',
          data: o.checkinTrend.map((t) => t.rate),
          smooth: true,
          symbolSize: 8,
          lineStyle: { color: theme.blue, width: 3 },
          itemStyle: { color: theme.blue },
          areaStyle: { color: '#eff6ff' },
          label: { show: true, formatter: '{c}%', fontSize: 11 },
        },
      ],
    })
    charts.push(chart)
  }

  // 3) 各作业平均分
  const hwEl = document.getElementById('chart-hw')
  if (hwEl && o.homeworkStats.length) {
    const chart = echarts.init(hwEl)
    chart.setOption({
      title: { text: '各作业班级平均分', left: 'center', textStyle: { fontSize: 14, color: '#1e293b' } },
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 30, top: 46, bottom: 40 },
      xAxis: { type: 'value', max: 100, axisLabel: { fontSize: 12 } },
      yAxis: { type: 'category', data: o.homeworkStats.map((h) => h.name), axisLabel: { fontSize: 12 } },
      series: [
        {
          type: 'bar',
          data: o.homeworkStats.map((h) => h.avg),
          barWidth: 18,
          itemStyle: { color: theme.blue, borderRadius: [0, 6, 6, 0] },
          label: { show: true, position: 'right', fontSize: 12 },
        },
      ],
    })
    charts.push(chart)
  }
}

async function load() {
  if (!courseId.value) return
  loading.value = true
  try {
    const res = await getCourseReport(courseId.value)
    report.value = res.data
    await nextTick()
    renderCharts()
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

function onSelect() {
  report.value = null
  message.value = ''
  if (courseId.value && !filteredCourses.value.some((c) => String(c.id) === courseId.value)) {
    courseId.value = filteredCourses.value[0] ? String(filteredCourses.value[0].id) : ''
  }
  load()
}

async function fetchCourses() {
  try {
    const res = await getCourses()
    courses.value = res.data.list
    if (!courseId.value && courses.value.length) courseId.value = String(courses.value[0].id)
    await load()
  } catch (e) {
    message.value = '课程加载失败：' + e.message
    loading.value = false
  }
}

async function exportExcel() {
  if (!courseId.value) return
  message.value = ''
  try {
    const blob = await exportCourseReport(courseId.value)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.value?.course?.name || '课程'}-学情报告.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    message.value = '导出失败：' + e.message
  }
}

function openStudent(s) {
  selected.value = s
}

onMounted(fetchCourses)
onBeforeUnmount(() => charts.forEach((c) => c.dispose()))

function goBack() { if (window.history.length > 1) router.back(); else router.push(`/teacher/courses/${courseId.value}`) }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      
    </header>
    <main>
      <div v-if="message" class="msg">{{ message }}</div>
      <div class="sel-row">
        <label>学年学期</label>
        <select v-model="semester" @change="onSelect">
          <option value="">全部</option>
          <option v-for="t in semesters" :key="t" :value="t">{{ t }}</option>
        </select>
        <label>选择课程</label>
        <select v-model="courseId" @change="onSelect">
          <option v-for="c in filteredCourses" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>
        <button class="export-btn" @click="exportExcel">导出 Excel</button>
      </div>
      <template v-if="report">
        <h2>课程学情报告 · {{ report.course.name }}（{{ report.course.credit }} 学分）</h2>
        <p class="tip">总体统计与可视化 · 点击学生行查看个人详情与各项排名</p>

        <!-- 总体概览卡 -->
        <div class="overview">
          <div class="ov-card"><b>{{ report.overall.studentCount }}</b><span>班级人数</span></div>
          <div class="ov-card"><b>{{ report.overall.avgCheckinScore ?? '-' }}</b><span>平均出勤分</span></div>
          <div class="ov-card"><b>{{ report.overall.avgHomeworkScore ?? '-' }}</b><span>作业均分</span></div>
          <div class="ov-card"><b>{{ report.overall.surveyParticipationRate ?? 0 }}%</b><span>调查参与率</span></div>
          <div class="ov-card"><b>{{ report.overall.avgExamScore ?? '-' }}</b><span>期末均分</span></div>
          <div class="ov-card main"><b>{{ report.overall.avgFinal ?? '-' }}</b><span>总成绩均分</span></div>
        </div>

        <!-- 图表 -->
        <div class="charts">
          <div class="chart-card"><div id="chart-dist" class="chart"></div></div>
          <div class="chart-card"><div id="chart-trend" class="chart"></div></div>
          <div class="chart-card"><div id="chart-hw" class="chart"></div></div>
        </div>

        <!-- 学生明细表 -->
        <div class="stu-table">
          <div class="st-head">
            <span>排名</span><span>姓名</span><span>学号</span><span>签到</span><span>作业</span><span>调查</span><span>期末</span><span>总成绩</span>
          </div>
          <div
            v-for="s in report.students"
            :key="s.student_id"
            class="st-row"
            @click="openStudent(s)"
          >
            <span><b class="rank" :class="{ top: s.finalRank === 1 }">{{ s.finalRank ?? '-' }}</b></span>
            <span class="name">{{ s.name }}</span>
            <span class="dim">{{ s.username }}</span>
            <span>{{ s.checkinScore }}<i v-if="s.checkinRank" class="rk">({{ s.checkinRank }})</i></span>
            <span>{{ s.homeworkScore }}<i v-if="s.homeworkRank" class="rk">({{ s.homeworkRank }})</i></span>
            <span>{{ s.surveyCount }}/{{ s.surveyTotal }}<i v-if="s.surveyRank" class="rk">({{ s.surveyRank }})</i></span>
            <span>{{ s.examScore ?? '-' }}<i v-if="s.examRank" class="rk">({{ s.examRank }})</i></span>
            <span class="final">{{ s.final ?? '待上传' }}</span>
          </div>
          <div v-if="report.students.length === 0" class="empty">暂无学生</div>
        </div>
        <p class="foot-note">括号内为该学生在本项上的班级名次（1 为最高）</p>

        <!-- 学生详情弹窗 -->
        <div v-if="selected" class="modal-mask" @click.self="selected = null">
          <div class="modal">
            <div class="modal-head">
              <b>{{ selected.name }}（{{ selected.username }}）</b>
              <button class="modal-close" @click="selected = null">✕</button>
            </div>
            <div class="modal-body">
              <div class="s-grid">
                <div class="s-item main">
                  <span class="s-label">总成绩</span>
                  <span class="s-score">{{ selected.final ?? '待上传' }}</span>
                  <span class="s-rank">班级第 {{ selected.finalRank ?? '-' }} 名</span>
                </div>
                <div class="s-item">
                  <span class="s-label">签到</span>
                  <span class="s-score">{{ selected.checkinScore }}</span>
                  <span class="s-rank">第 {{ selected.checkinRank ?? '-' }} 名</span>
                </div>
                <div class="s-item">
                  <span class="s-label">作业</span>
                  <span class="s-score">{{ selected.homeworkScore }}</span>
                  <span class="s-rank">第 {{ selected.homeworkRank ?? '-' }} 名</span>
                </div>
                <div class="s-item">
                  <span class="s-label">学情调查</span>
                  <span class="s-score">{{ selected.surveyCount }}/{{ selected.surveyTotal }}</span>
                  <span class="s-rank">第 {{ selected.surveyRank ?? '-' }} 名</span>
                </div>
                <div class="s-item">
                  <span class="s-label">期末</span>
                  <span class="s-score">{{ selected.examScore ?? '-' }}</span>
                  <span class="s-rank">第 {{ selected.examRank ?? '-' }} 名</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div v-else-if="loading" class="empty">报告生成中...</div>
    </main>
  </div>
</template>

<style scoped>
.sel-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 14px; }
.sel-row label { font-size: 13px; color: #6b7280; }
.sel-row select { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: #fff; min-width: 160px; }
.export-btn { margin-left: auto; padding: 8px 16px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-size: 14px; cursor: pointer; }
.export-btn:hover { background: #1d4ed8; }
@media (max-width: 768px) { .export-btn { margin-left: 0; width: 100%; } .sel-row select { flex: 1; min-width: 0; } }
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
.tip { color: #6b7280; font-size: 13px; margin: 0 0 16px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.empty { text-align: center; color: #9ca3af; padding: 40px 0; font-size: 13px; }

.overview { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
.ov-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 14px 10px; text-align: center;
}
.ov-card.main { background: #eff6ff; border-color: #bfdbfe; }
.ov-card b { font-size: 22px; color: #1e293b; display: block; }
.ov-card span { font-size: 12px; color: #6b7280; }

.charts { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; }
.chart-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px; }
.chart { width: 100%; height: 260px; }

.stu-table { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
.st-head, .st-row {
  display: grid; grid-template-columns: 60px 1.2fr 1fr 0.9fr 0.9fr 1fr 0.9fr 0.9fr;
  gap: 8px; align-items: center; padding: 12px 16px; font-size: 13px;
}
.st-head { background: #f8fafc; color: #6b7280; font-weight: 600; }
.st-row { border-top: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; }
.st-row:hover { background: #eff6ff; }
.rank { display: inline-block; min-width: 24px; text-align: center; padding: 2px 8px; border-radius: 20px; background: #f3f4f6; }
.rank.top { background: #2563eb; color: #fff; }
.name { font-weight: 600; color: #1e293b; }
.dim { color: #9ca3af; }
.rk { font-style: normal; color: #93c5fd; font-size: 11px; margin-left: 2px; }
.final { font-weight: 700; color: #2563eb; }
.foot-note { color: #9ca3af; font-size: 12px; margin-top: 8px; }

.modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #f8fafc; border-radius: 14px; width: 560px; max-width: 92vw; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2); }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #e5e7eb; background: #fff; border-radius: 14px 14px 0 0; font-size: 15px; }
.modal-close { background: none; border: none; font-size: 15px; cursor: pointer; color: #6b7280; }
.modal-body { padding: 16px 20px; }
.s-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.s-item { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; }
.s-item.main { grid-column: span 2; background: #eff6ff; border-color: #bfdbfe; }
.s-label { font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px; }
.s-score { font-size: 24px; font-weight: 700; color: #1e293b; }
.s-rank { font-size: 12px; color: #2563eb; margin-left: 8px; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
