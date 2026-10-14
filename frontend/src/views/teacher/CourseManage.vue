<script setup>
// 教师端-课堂项目管理：我的课堂列表 + 新建课堂
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCourses, createCourse } from '../../api/course'

const router = useRouter()
const list = ref([])
const loading = ref(false)
const showDialog = ref(false)
const message = ref('')

const form = ref({
  name: '',
  semester: '',
  weeks: '',
  scheduleTime: '',
  location: '',
  credit: 3.0,
  checkinWeight: 20,
  homeworkWeight: 20,
  examWeight: 60,
})

async function fetchList() {
  loading.value = true
  try {
    const res = await getCourses()
    list.value = res.data.list
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = { name: '', semester: '', weeks: '', scheduleTime: '', location: '', credit: 3.0, checkinWeight: 20, homeworkWeight: 20, examWeight: 60 }
  message.value = ''
  showDialog.value = true
}

async function submit() {
  if (!form.value.name) {
    message.value = '课程名称必填'
    return
  }
  if (!(Number(form.value.credit) > 0) || Number(form.value.credit) > 99) {
    message.value = '学分必须为大于 0 且不超过 99 的数字'
    return
  }
  const sum = Number(form.value.checkinWeight) + Number(form.value.homeworkWeight) + Number(form.value.examWeight)
  if (sum !== 100) {
    message.value = `权重之和必须为 100，当前 ${sum}`
    return
  }
  try {
    await createCourse(form.value)
    message.value = '创建成功'
    showDialog.value = false
    fetchList()
  } catch (e) {
    message.value = e.message
  }
}

function openDetail(id) {
  router.push(`/teacher/courses/${id}`)
}

onMounted(fetchList)

function goBack() { if (window.history.length > 1) router.back(); else router.push('/teacher') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">教师端</span></div>
      
    </header>
    <main>
      <div class="head-row">
        <div>
          <h2>我的课堂</h2>
          <p class="tip">共 {{ list.length }} 门课程 · 卡片内含课堂码/二维码/学生名单/权重</p>
        </div>
        <button class="primary" @click="openCreate">+ 新建课堂</button>
      </div>
      <p v-if="message" class="msg">{{ message }}</p>

      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="list.length === 0" class="empty">还没有课堂，点右上角「新建课堂」创建第一门课</div>
      <div v-else class="grid">
        <div v-for="c in list" :key="c.id" class="card" @click="openDetail(c.id)">
          <h3>{{ c.name }} <span class="credit">{{ Number(c.credit) }} 学分</span></h3>
          <p class="meta">{{ c.semester || '-' }} · {{ c.weeks || '-' }}</p>
          <p class="meta">{{ c.schedule_time || '-' }} · {{ c.location || '-' }}</p>
          <div class="foot">
            <span class="code">课堂码 {{ c.join_code }}</span>
            <span class="weight">权重 签到{{ c.weights?.checkin_weight }}/作业{{ c.weights?.homework_weight }}/期末{{ c.weights?.exam_weight }}</span>
          </div>
        </div>
      </div>

      <!-- 新建课堂弹窗 -->
      <div v-if="showDialog" class="mask" @click.self="showDialog = false">
        <div class="dialog">
          <h3>新建课堂</h3>
          <div class="form-grid">
            <label class="full">课程名称 *<input v-model="form.name" placeholder="如：高级软件工程" /></label>
            <label>学期<input v-model="form.semester" placeholder="如：2026秋季" /></label>
            <label>周次<input v-model="form.weeks" placeholder="如：1-16" /></label>
            <label>上课时间<input v-model="form.scheduleTime" placeholder="如：周一 08:00-09:40" /></label>
            <label>上课地点<input v-model="form.location" placeholder="如：三教 301" /></label>
            <label>学分<input v-model.number="form.credit" type="number" step="0.5" placeholder="如：3" /></label>
            <label class="full weight-title">成绩权重（合计必须为 100）</label>
            <label>签到 %<input v-model.number="form.checkinWeight" type="number" /></label>
            <label>作业 %<input v-model.number="form.homeworkWeight" type="number" /></label>
            <label>期末 %<input v-model.number="form.examWeight" type="number" /></label>
          </div>
          <div class="dialog-btns">
            <button @click="showDialog = false">取消</button>
            <button class="primary" @click="submit">创建</button>
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
main { max-width: 1080px; margin: 0 auto; padding: 28px 20px; }
.head-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 14px; margin: 0; }
.primary {
  padding: 10px 20px; background: #2563eb; color: #fff; border: none;
  border-radius: 8px; font-size: 14px; cursor: pointer;
}
.msg { color: #047857; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 20px; cursor: pointer; transition: box-shadow 0.2s;
}
.card:hover { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08); }
.card h3 { margin: 0 0 8px; font-size: 17px; }
.credit {
  display: inline-block; font-size: 12px; font-weight: 500; color: #047857;
  background: #ecfdf5; border-radius: 6px; padding: 2px 8px; margin-left: 8px; vertical-align: middle;
}
.meta { color: #6b7280; font-size: 13px; margin: 4px 0; }
.foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e5e7eb; }
.code {
  background: #eff6ff; color: #1d4ed8; font-size: 13px; font-weight: 600;
  padding: 4px 12px; border-radius: 6px;
}
.weight { color: #9ca3af; font-size: 12px; }
.empty { text-align: center; color: #9ca3af; padding: 60px 0; }
.mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.dialog { width: 560px; background: #fff; border-radius: 14px; padding: 24px; }
.dialog h3 { margin: 0 0 18px; font-size: 17px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid .full { grid-column: 1 / -1; }
.form-grid label { font-size: 13px; color: #374151; display: flex; flex-direction: column; gap: 4px; }
.form-grid input {
  padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; outline: none;
}
.weight-title { color: #6b7280; margin-top: 6px; }
.dialog-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.dialog-btns button {
  padding: 8px 18px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; font-size: 13px; cursor: pointer;
}
.dialog-btns .primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
