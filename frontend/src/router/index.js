// 前端路由：登录页 + 三端首页，带登录与角色守卫
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/login' },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/student',
    name: 'student',
    component: () => import('../views/student/StudentHome.vue'),
    meta: { role: 'student', title: '学生端' },
  },
  {
    path: '/student/courses',
    name: 'student-courses',
    component: () => import('../views/student/MyCourses.vue'),
    meta: { role: 'student', title: '我的课堂' },
  },
  {
    path: '/student/courses/:id',
    name: 'student-course-workbench',
    component: () => import('../views/student/StudentCourseWorkbench.vue'),
    meta: { role: 'student', title: '课堂工作台' },
  },
  {
    path: '/student/classroom',
    name: 'student-classroom',
    component: () => import('../views/student/StudentClassroom.vue'),
    meta: { role: 'student', title: '进入课堂' },
  },
  {
    path: '/student/checkins',
    name: 'student-checkins',
    component: () => import('../views/student/StudentCheckin.vue'),
    meta: { role: 'student', title: '课堂签到' },
  },
  {
    path: '/student/emotions',
    name: 'student-emotions',
    component: () => import('../views/student/EmotionSubmit.vue'),
    meta: { role: 'student', title: '表情反馈' },
  },
  {
    path: '/student/homeworks',
    name: 'student-homeworks',
    component: () => import('../views/student/HomeworkSubmit.vue'),
    meta: { role: 'student', title: '我的作业' },
  },
  {
    path: '/student/surveys',
    name: 'student-surveys',
    component: () => import('../views/student/SurveySubmit.vue'),
    meta: { role: 'student', title: '学情调查' },
  },
  {
    path: '/student/exams',
    name: 'student-exams',
    component: () => import('../views/student/ExamPage.vue'),
    meta: { role: 'student', title: '期末考试与总成绩' },
  },
  {
    path: '/student/scores',
    name: 'student-scores',
    component: () => import('../views/student/ScoreDetail.vue'),
    meta: { role: 'student', title: '我的成绩' },
  },
  {
    path: '/student/report',
    name: 'student-report',
    component: () => import('../views/student/StudentReport.vue'),
    meta: { role: 'student', title: '课程学情报告' },
  },
  {
    path: '/student/notifications',
    name: 'student-notifications',
    component: () => import('../views/Notifications.vue'),
    meta: { role: 'student', title: '通知中心' },
  },
  {
    path: '/teacher/notifications',
    name: 'teacher-notifications',
    component: () => import('../views/Notifications.vue'),
    meta: { role: 'teacher', title: '通知中心' },
  },
  {
    path: '/admin/notifications',
    name: 'admin-notifications',
    component: () => import('../views/Notifications.vue'),
    meta: { role: 'admin', title: '通知中心' },
  },
  {
    path: '/teacher',
    name: 'teacher',
    component: () => import('../views/teacher/TeacherHome.vue'),
    meta: { role: 'teacher', title: '教师端' },
  },
  {
    path: '/teacher/courses',
    name: 'teacher-courses',
    component: () => import('../views/teacher/CourseManage.vue'),
    meta: { role: 'teacher', title: '课堂管理' },
  },
  {
    path: '/teacher/courses/:id',
    name: 'teacher-course-detail',
    component: () => import('../views/teacher/CourseDetail.vue'),
    meta: { role: 'teacher', title: '课堂详情' },
  },
  {
    path: '/teacher/courses/:id/classroom',
    name: 'teacher-classroom',
    component: () => import('../views/teacher/TeacherClassroom.vue'),
    meta: { role: 'teacher', title: '开始上课' },
  },
  {
    path: '/teacher/courses/:id/checkins',
    name: 'teacher-checkins',
    component: () => import('../views/teacher/CheckinManage.vue'),
    meta: { role: 'teacher', title: '课堂定位签到' },
  },
  {
    path: '/teacher/courses/:id/emotions',
    name: 'teacher-emotions',
    component: () => import('../views/teacher/EmotionManage.vue'),
    meta: { role: 'teacher', title: '表情学情统计' },
  },
  {
    path: '/teacher/courses/:id/homeworks',
    name: 'teacher-homeworks',
    component: () => import('../views/teacher/HomeworkManage.vue'),
    meta: { role: 'teacher', title: '随堂作业' },
  },
  {
    path: '/teacher/courses/:id/surveys',
    name: 'teacher-surveys',
    component: () => import('../views/teacher/SurveyManage.vue'),
    meta: { role: 'teacher', title: '学情调查' },
  },
  {
    path: '/teacher/courses/:id/exams',
    name: 'teacher-exams',
    component: () => import('../views/teacher/ExamManage.vue'),
    meta: { role: 'teacher', title: '期末考试与总成绩' },
  },
  {
    path: '/teacher/courses/:id/scores',
    name: 'teacher-scores',
    component: () => import('../views/teacher/ScoreManage.vue'),
    meta: { role: 'teacher', title: '成绩管理' },
  },
  {
    path: '/teacher/courses/:id/report',
    name: 'teacher-report',
    component: () => import('../views/teacher/ReportPage.vue'),
    meta: { role: 'teacher', title: '课程学情报告' },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/admin/AdminHome.vue'),
    meta: { role: 'admin', title: '管理端' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('../views/admin/UserManage.vue'),
    meta: { role: 'admin', title: '用户管理' },
  },
  {
    path: '/admin/courses',
    name: 'admin-courses',
    component: () => import('../views/admin/AdminCourses.vue'),
    meta: { role: 'admin', title: '课堂总览' },
  },
  {
    path: '/admin/scores',
    name: 'admin-scores',
    component: () => import('../views/admin/AdminScores.vue'),
    meta: { role: 'admin', title: '成绩管理' },
  },
  {
    path: '/admin/report',
    name: 'admin-report',
    component: () => import('../views/admin/AdminReport.vue'),
    meta: { role: 'admin', title: '课程学情报告' },
  },
  {
    path: '/admin/stats-periods',
    name: 'admin-stats-periods',
    component: () => import('../views/admin/AdminStatsPeriod.vue'),
    meta: { role: 'admin', title: '统计周期配置' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 全局守卫：登录校验 + 角色校验
router.beforeEach((to) => {
  const token = sessionStorage.getItem('token')
  const user = JSON.parse(sessionStorage.getItem('user') || 'null')

  if (to.meta.public) {
    // 已登录访问登录页 → 跳回对应端口
    if (token && user) return homePath(user.role)
    return true
  }
  if (!token || !user) return { path: '/login' }
  if (to.meta.role && to.meta.role !== user.role) return homePath(user.role)
  return true
})

// 按角色返回首页路径
function homePath(role) {
  const map = { student: '/student', teacher: '/teacher', admin: '/admin' }
  return map[role] || '/login'
}

export default router
