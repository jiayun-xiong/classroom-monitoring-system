<script setup>
const router = useRouter()
// 学生端-课程学情报告：课程选择 + 总体统计（可视化）+ 自己各项成绩与班级排名
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { getCourses } from '../../api/course'
import { getMyReport, exportCourseReport } from '../../api/report'
import { useRouter } from 'vue-router'

const courses = ref([])
const courseId = ref('')
const semester = ref('')
const report = ref(null)
const message = ref('')
const loading = ref(false)
let charts = []

const semesters = computed(() => [...new Set(courses.value.map((c) => c.semester).filter(Boolean))])
const filteredCourses = computed(() => (semester.value ? courses.value.filter((c) => c.semester === semester.value) : courses.value))

function renderCharts() {
  charts.forEach((c) => c.dispose())
  charts = []
  const o = report.value.overall
  const theme = { blue: '#2563eb' }

  const distEl = document.getElementById('s-chart-dist')
  if (distEl) {
    const chart = echarts.init(distEl)
    chart.setOption({
      title: { text: '班级总成绩分布', left: 'center', textStyle: { fontSize: 14, color: '#1e293b' } },
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 46, bottom: 28 },
      xAxis: { type: 'category', data: o.gradeDist.map((d) => d.range), axisLabel: { fontSize: 12 } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 12 } },
      series: [{ type: 'bar', data: o.gradeDist.map((d) => d.count), barWidth: 40, itemStyle: { color: theme.blue, borderRadius: [6, 6, 0, 0] }, label: { show: true, position: 'top', fontSize: 12 } }],
    })
    charts.push(chart)
  }

  const trendEl = document.getElementById('s-chart-trend')
  if (trendEl) {
    const chart = echarts.init(trendEl)
    chart.setOption({
      title: { text: '各次课堂出勤率趋势', left: 'center', textStyle: { fontSize: 14, color: '#1e293b' } },
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 46, bottom: 28 },
      xAxis: { type: 'category', data: o.checkinTrend.map((t) => `第${t.sessionId}次`) },
      yAxis: { type: 'value', max: 100, axisLabel: { fontSize: 12, formatter: '{value}%' } },
      series: [{ type: 'line', data: o.checkinTrend.map((t) => t.rate), smooth: true, symbolSize: 8, lineStyle: { color: theme.blue, width: 3 }, itemStyle: { color: theme.blue }, areaStyle: { color: '#eff6ff' }, label: { show: true, formatter: '{c}%', fontSize: 11 } }],
    })
    charts.push(chart)
  }

  const hwEl = document.getElementById('s-chart-hw')
  if (hwEl && o.homeworkStats.length) {
    const chart = echarts.init(hwEl)
    chart.setOption({
      title: { text: '各作业班级平均分', left: 'center', textStyle: { fontSize: 14, color: '#1e293b' } },
      tooltip: { trigger: 'axis' },
      grid: { left: 70, right: 30, top: 46, bottom: 40 },
      xAxis: { type: 'value', max: 100, axisLabel: { fontSize: 12 } },
      yAxis: { type: 'category', data: o.homeworkStats.map((h) => h.name), axisLabel: { fontSize: 12 } },
      series: [{ type: 'bar', data: o.homeworkStats.map((h) => h.avg), barWidth: 18, itemStyle: { color: theme.blue, borderRadius: [0, 6, 6, 0] }, label: { show: true, position: 'right', fontSize: 12 } }],
    })
    charts.push(chart)
  }
}

async function loadReport() {
  if (!courseId.value) return
  loading.value = true
  message.value = ''
  try {
    const res = await getMyReport(courseId.value)
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
  if (courseId.value && !filteredCourses.value.some((c) => String(c.id) === courseId.value)) {
    courseId.value = filteredCourses.value[0] ? String(filteredCourses.value[0].id) : ''
  }
  loadReport()
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

async function loadCourses() {
  try {
    const res = await getCourses()
    courses.value = res.data.list
    if (courses.value.length) {
      courseId.value = String(courses.value[0].id)
      loadReport()
    }
  } catch (e) {
    message.value = '课程加载失败：' + e.message
  }
}

onMounted(loadCourses)
onBeforeUnmount(() => charts.forEach((c) => c.dispose()))

function goBack() { if (window.history.length > 1) router.back(); else router.push('/student') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">学生端</span></div>
      
    </header>
    <main>
      <h2>课程学情报告</h2>
      <p class="tip">班级总体学情可视化 + 我的成绩与每项班级排名（只读）</p>

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
      <p v-if="message" class="msg">{{ message }}</p>

      <template v-if="report">
        <h3 class="course-name">{{ report.course.name }}（{{ report.course.credit }} 学分）</h3>

        <!-- 总体概览 -->
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
          <div class="chart-card"><div id="s-chart-dist" class="chart"></div></div>
          <div class="chart-card"><div id="s-chart-trend" class="chart"></div></div>
          <div class="chart-card"><div id="s-chart-hw" class="chart"></div></div>
        </div>

        <!-- 我的成绩 -->
        <h3 class="sec-title">我的成绩与排名</h3>
        <div v-if="report.me" class="me-grid">
          <div class="me-item main">
            <span class="me-label">加权总成绩</span>
            <span class="me-score">{{ report.me.final ?? '待上传' }}</span>
            <span class="me-rank">班级第 {{ report.me.finalRank ?? '-' }} 名 / {{ report.me.totalStudents }} 人</span>
          </div>
          <div class="me-item">
            <span class="me-label">签到</span>
            <span class="me-score">{{ report.me.checkinScore }}</span>
            <span class="me-rank">第 {{ report.me.checkinRank ?? '-' }} / {{ report.me.totalStudents }} 名</span>
          </div>
          <div class="me-item">
            <span class="me-label">作业</span>
            <span class="me-score">{{ report.me.homeworkScore }}</span>
            <span class="me-rank">第 {{ report.me.homeworkRank ?? '-' }} / {{ report.me.totalStudents }} 名</span>
          </div>
          <div class="me-item">
            <span class="me-label">学情调查</span>
            <span class="me-score">{{ report.me.surveyCount }}/{{ report.me.surveyTotal }}</span>
            <span class="me-rank">第 {{ report.me.surveyRank ?? '-' }} / {{ report.me.totalStudents }} 名</span>
          </div>
          <div class="me-item">
            <span class="me-label">期末</span>
            <span class="me-score">{{ report.me.examScore ?? '-' }}</span>
            <span class="me-rank">第 {{ report.me.examRank ?? '-' }} / {{ report.me.totalStudents }} 名</span>
          </div>
        </div>
        <p v-else class="empty">暂无成绩数据</p>
      </template>
      <div v-else-if="loading" class="empty">报告生成中...</div>
    </main>
  </div>
</template>

<style scoped>
.page { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; min-height: 100vh; background: #f8fafc; }
header { display: flex; justify-content: space-between; align-items: center; padding: 0 32px; height: 56px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.brand { font-size: 16px; font-weight: 600; }
.role { color: #2563eb; }
.back a { color: #2563eb; font-size: 14px; text-decoration: none; }
main { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 13px; margin: 0 0 14px; }
.msg { color: #047857; font-size: 13px; margin: 0 0 12px; }
.empty { text-align: center; color: #9ca3af; padding: 30px 0; font-size: 13px; }
.course-name { font-size: 17px; margin: 4px 0 12px; color: #1e293b; }
.sec-title { font-size: 17px; margin: 18px 0 10px; color: #1e293b; }

.sel-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.sel-row label { font-size: 13px; color: #6b7280; }
.sel-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 14px; }
.sel-row label { font-size: 13px; color: #6b7280; }
.sel-row select { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: #fff; min-width: 160px; }
.export-btn { margin-left: auto; padding: 8px 16px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-size: 14px; cursor: pointer; }
.export-btn:hover { background: #1d4ed8; }
@media (max-width: 768px) { .export-btn { margin-left: 0; width: 100%; } .sel-row select { flex: 1; min-width: 0; } }

.overview { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
.ov-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 10px; text-align: center; }
.ov-card.main { background: #eff6ff; border-color: #bfdbfe; }
.ov-card b { font-size: 22px; color: #1e293b; display: block; }
.ov-card span { font-size: 12px; color: #6b7280; }

.charts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 8px; }
.chart-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px; }
.chart { width: 100%; height: 260px; }

.me-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.me-item { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; }
.me-item.main { grid-column: span 2; background: linear-gradient(135deg, #1e40af, #2563eb); border: none; }
.me-label { font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px; }
.me-item.main .me-label { color: rgba(255, 255, 255, 0.85); }
.me-score { font-size: 26px; font-weight: 700; color: #1e293b; }
.me-item.main .me-score { color: #fff; }
.me-rank { font-size: 12px; color: #2563eb; margin-left: 8px; }
.me-item.main .me-rank { color: #bfdbfe; }
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
  .charts { grid-template-columns: 1fr !important; }
  .me-grid { grid-template-columns: 1fr; }
  .overview { grid-template-columns: 1fr 1fr !important; }
}
</style>
