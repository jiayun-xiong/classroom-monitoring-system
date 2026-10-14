<script setup>
const router = useRouter()
// 管理端-用户管理：列表/筛选/搜索/创建/编辑/删除
import { onMounted, ref } from 'vue'
import { getUsers, createUser, updateUser, deleteUser } from '../../api/user'
import { useRouter } from 'vue-router'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const query = ref({ page: 1, size: 10, role: '', keyword: '' })
const showDialog = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const message = ref('')

// 表单字段
const form = ref({
  username: '',
  password: '',
  name: '',
  role: 'student',
  phone: '',
  studentNo: '',
  grade: '',
  className: '',
  major: '',
})

const roleLabels = { student: '学生', teacher: '教师', admin: '管理员' }

async function fetchList() {
  loading.value = true
  try {
    const params = { page: query.value.page, size: query.value.size }
    if (query.value.role) params.role = query.value.role
    if (query.value.keyword) params.keyword = query.value.keyword
    const res = await getUsers(params)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {
    message.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

function search() {
  query.value.page = 1
  fetchList()
}

function resetQuery() {
  query.value = { page: 1, size: 10, role: '', keyword: '' }
  fetchList()
}

function openCreate() {
  isEdit.value = false
  editId.value = null
  form.value = { username: '', password: '', name: '', role: 'student', phone: '', studentNo: '', grade: '', className: '', major: '' }
  showDialog.value = true
}

function openEdit(user) {
  isEdit.value = true
  editId.value = user.id
  form.value = {
    username: user.username,
    password: '',
    name: user.name || '',
    role: user.role,
    phone: user.phone || '',
    studentNo: user.student?.student_no || '',
    grade: user.student?.grade || '',
    className: user.student?.class_name || '',
    major: user.student?.major || '',
  }
  showDialog.value = true
}

async function submit() {
  message.value = ''
  if (!form.value.username || (!isEdit.value && !form.value.password) || !form.value.name) {
    message.value = '用户名、密码（新建）、姓名必填'
    return
  }
  try {
    if (isEdit.value) {
      await updateUser(editId.value, form.value)
      message.value = '更新成功'
    } else {
      await createUser(form.value)
      message.value = '创建成功'
    }
    showDialog.value = false
    fetchList()
  } catch (e) {
    message.value = e.message
  }
}

async function remove(user) {
  if (!confirm(`确定删除用户「${user.name}（${user.username}）」？此操作不可恢复`)) return
  try {
    await deleteUser(user.id)
    message.value = '删除成功'
    fetchList()
  } catch (e) {
    message.value = e.message
  }
}

onMounted(fetchList)

function goBack() { if (window.history.length > 1) router.back(); else router.push('/admin') }
</script>

<template>
  <div class="page">
    <header>
      
      <button class="back" @click="goBack">←</button><div class="brand">课堂学情监控管理系统 · <span class="role">管理端</span></div>
      
    </header>
    <main>
      <h2>用户管理</h2>
      <p class="tip">共 {{ total }} 个用户 · 仅管理员可增删改</p>

      <div class="toolbar">
        <select v-model="query.role" @change="search">
          <option value="">全部角色</option>
          <option value="student">学生</option>
          <option value="teacher">教师</option>
          <option value="admin">管理员</option>
        </select>
        <input v-model="query.keyword" placeholder="搜索用户名/姓名/手机号" @keyup.enter="search" />
        <button class="primary" @click="search">搜索</button>
        <button @click="resetQuery">重置</button>
        <button class="primary" style="margin-left:auto" @click="openCreate">+ 创建用户</button>
      </div>

      <p v-if="message" class="msg">{{ message }}</p>

      <table>
        <thead>
          <tr>
            <th>ID</th><th>用户名</th><th>姓名</th><th>角色</th><th>手机号</th>
            <th>学号</th><th>班级</th><th>专业</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.username }}</td>
            <td>{{ u.name }}</td>
            <td><span class="role-badge" :class="u.role">{{ roleLabels[u.role] }}</span></td>
            <td>{{ u.phone || '-' }}</td>
            <td>{{ u.student?.student_no || '-' }}</td>
            <td>{{ u.student?.class_name || '-' }}</td>
            <td>{{ u.student?.major || '-' }}</td>
            <td>
              <button class="link" @click="openEdit(u)">编辑</button>
              <button class="link danger" @click="remove(u)">删除</button>
            </td>
          </tr>
          <tr v-if="!loading && list.length === 0">
            <td colspan="9" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <button :disabled="query.page <= 1" @click="query.page--; fetchList()">上一页</button>
        <span>第 {{ query.page }} 页 / 共 {{ Math.ceil(total / query.size) || 1 }} 页</span>
        <button :disabled="query.page >= Math.ceil(total / query.size)" @click="query.page++; fetchList()">下一页</button>
      </div>

      <!-- 创建/编辑弹窗 -->
      <div v-if="showDialog" class="mask" @click.self="showDialog = false">
        <div class="dialog">
          <h3>{{ isEdit ? '编辑用户' : '创建用户' }}</h3>
          <div class="form-grid">
            <label>用户名 *<input v-model="form.username" :disabled="isEdit" placeholder="登录名" /></label>
            <label>密码 {{ isEdit ? '(留空不修改)' : '*' }}<input v-model="form.password" type="password" placeholder="登录密码" /></label>
            <label>姓名 *<input v-model="form.name" placeholder="姓名" /></label>
            <label>角色<select v-model="form.role"><option value="student">学生</option><option value="teacher">教师</option><option value="admin">管理员</option></select></label>
            <label>手机号<input v-model="form.phone" placeholder="手机号" /></label>
            <template v-if="form.role === 'student'">
              <label>学号<input v-model="form.studentNo" placeholder="学号" /></label>
              <label>年级<input v-model="form.grade" placeholder="年级" /></label>
              <label>班级<input v-model="form.className" placeholder="班级" /></label>
              <label>专业<input v-model="form.major" placeholder="专业" /></label>
            </template>
          </div>
          <div class="dialog-btns">
            <button @click="showDialog = false">取消</button>
            <button class="primary" @click="submit">保存</button>
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
main { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
h2 { font-size: 22px; margin: 0 0 6px; }
.tip { color: #6b7280; font-size: 14px; margin: 0 0 20px; }
.toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
.toolbar select, .toolbar input {
  padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; outline: none;
}
.toolbar input { width: 220px; }
.toolbar button, .dialog-btns button {
  padding: 8px 16px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px;
  font-size: 13px; cursor: pointer;
}
.toolbar .primary, .dialog-btns .primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.msg { color: #047857; font-size: 13px; }
table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }
th, td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
th { background: #f8fafc; font-weight: 600; }
.role-badge { padding: 2px 10px; border-radius: 99px; font-size: 12px; }
.role-badge.student { background: #dbeafe; color: #1d4ed8; }
.role-badge.teacher { background: #fef3c7; color: #b45309; }
.role-badge.admin { background: #fce7f3; color: #be185d; }
.link { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 13px; padding: 2px 6px; }
.link.danger { color: #dc2626; }
.empty { text-align: center; color: #9ca3af; padding: 30px 0; }
.pager { display: flex; gap: 12px; align-items: center; justify-content: flex-end; margin-top: 14px; font-size: 13px; color: #6b7280; }
.pager button { padding: 6px 14px; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; cursor: pointer; }
.pager button:disabled { opacity: 0.4; cursor: not-allowed; }
.mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.dialog { width: 520px; background: #fff; border-radius: 14px; padding: 24px; }
.dialog h3 { margin: 0 0 18px; font-size: 17px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid label { font-size: 13px; color: #374151; display: flex; flex-direction: column; gap: 4px; }
.form-grid input, .form-grid select {
  padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; outline: none;
}
.dialog-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; color: #374151; font-size: 15px; cursor: pointer;
  margin-bottom: 12px;
}
.back:hover { background: #f8fafc; }

</style>
