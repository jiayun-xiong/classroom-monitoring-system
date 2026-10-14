# 课堂学情监控管理系统

中国科学技术大学《高级软件工程》课程大作业 · Vibe Coding 多 Agent 接力开发。

## 项目简介

面向课堂教学场景的学情监控管理系统，包含学生端、教师端、管理端三个端口，覆盖课堂签到、表情反馈、随堂作业、学情调查、期末考试与加权成绩、课程学情报告、通知中心、讨论区与弹幕等功能，并支持学生端移动端浏览器访问。

## 目录结构

```
.
├── backend/                 # 后端服务（Node.js + Express + Sequelize + MySQL）
│   ├── src/
│   │   ├── app.js           # 应用入口与路由挂载
│   │   ├── server.js        # 服务启动（sequelize.sync 自动建表）
│   │   ├── config/          # 数据库等配置
│   │   ├── controllers/     # 业务控制器
│   │   ├── models/          # 数据模型（自动建表）
│   │   ├── routes/          # 接口路由
│   │   ├── middlewares/     # 鉴权中间件（JWT）
│   │   ├── services/        # 业务服务层
│   │   ├── socket/          # WebSocket（弹幕实时推送）
│   │   ├── jobs/            # 定时任务
│   │   └── seed/            # 种子数据
│   └── package.json
├── frontend/                # 前端（Vue 3 + Vite + Pinia + ECharts）
│   └── src/
│       ├── api/             # 接口封装
│       ├── components/      # 通用组件（通知铃铛、弹幕面板等）
│       ├── stores/          # Pinia 状态
│       ├── views/           # 页面（student / teacher / admin 三端）
│       └── router/          # 路由与权限守卫
└── README.md
```

## 技术栈

- 前端：Vue 3 + Vite + Vue Router + Pinia + ECharts（响应式，支持移动端浏览器）
- 后端：Node.js + Express + Sequelize ORM
- 数据库：MySQL 8
- 认证：JWT 无状态令牌
- 实时：Socket.IO（弹幕）+ 1 秒轮询（通知）

## 快速启动

### 1. 数据库

创建 MySQL 数据库（默认库名 `classroom_monitor`）：

```sql
CREATE DATABASE classroom_monitor DEFAULT CHARACTER SET utf8mb4;
```

### 2. 后端

```bash
cd backend
cp .env.example .env    # 按本机 MySQL 配置修改 DB_* 变量
npm install
npm run dev             # 或 npm start；启动时自动建表并写入种子数据
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev             # 默认 http://localhost:5173
```

### 4. 访问

- 学生端：http://localhost:5173/student
- 教师端：http://localhost:5173/teacher
- 管理端：http://localhost:5173/admin

## 测试账号

| 角色 | 用户名 | 密码 | 手机号 |
|---|---|---|---|
| 管理员 | admin | admin123 | 13700000000 |
| 教师 | lilaoshi / wanglaoshi | 123456 | 13800000001 / 13800000002 |
| 学生 | zhangsan / lisi / wangwu / zhaoliu / sunqi | 123456 | 13900000001 ~ 13900000005 |

## 开发规范约定

- 后端接口统一返回 `{ code, message, data }`
- 数据库表字段使用 snake_case，前端请求参数使用 camelCase
- 消息轮询统一 1 秒；弹幕实时消息走 Socket.IO

详细部署与问题排查见《系统安装调试手册》（提交文档）。
