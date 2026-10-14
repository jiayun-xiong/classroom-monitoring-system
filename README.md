# 课堂学情监控管理系统

中国科学技术大学《高级软件工程》课程大作业。

面向课堂教学场景的三端系统（学生 / 教师 / 管理员），覆盖课堂签到、6 档表情反馈、随堂作业、学情调查、考试与加权成绩、课程学情报告、通知中心、讨论区与弹幕等功能，学生端适配移动端浏览器。

---

## 一、你只需要准备一样东西：Node.js

> 完全新手看这一段就够了。本系统**不需要你装 MySQL**——默认用文件数据库（SQLite），解压即用。

| 需要安装 | 版本要求 | 下载地址 |
|---|---|---|
| **Node.js** | 20 或更高 | https://nodejs.org/zh-cn/download |

下载后双击安装包，全部一路点"继续 / 下一步"即可，不用改任何选项。

安装完成后，**新开一个终端（Mac 是"终端"App，Windows 是"命令提示符"）**，输入下面命令能看到版本号就说明装好了：

```bash
node -v
# 看到 v20.x 或 v22.x 之类即成功
```

---

## 二、最快上手（推荐新手用这个）

### Mac 用户

打开"终端"，进入项目文件夹，执行：

```bash
bash start.sh
```

### Windows 用户

打开项目文件夹，**双击 `start.bat`**。

脚本会自动完成：检查 Node → 生成配置 → 安装依赖（首次约 3~5 分钟）→ 启动后端和前端。

> 国内网络如果 `npm install` 很慢，可以先换国内镜像源再启动：
> ```bash
> npm config set registry https://registry.npmmirror.com
> ```

---

## 三、手动启动方式（想自己一步步看的）

如果你不想用脚本，也可以手动执行。打开**两个终端窗口**：

**窗口 1 —— 后端：**

```bash
cd backend
cp .env.example .env     # Windows 用 copy .env.example .env
npm install
npm run dev
```

**窗口 2 —— 前端：**

```bash
cd frontend
npm install
npm run dev
```

`.env.example` 默认就是 SQLite 模式，**什么都不用改**，直接能跑。

---

## 四、访问系统

启动成功后，浏览器打开：

| 端 | 地址 |
|---|---|
| 学生端 | http://localhost:5173/student |
| 教师端 | http://localhost:5173/teacher |
| 管理端 | http://localhost:5173/admin |

**测试账号**（首次启动自动创建）：

| 角色 | 用户名 | 密码 |
|---|---|---|
| 管理员 | `admin` | `admin123` |
| 教师 | `teacher1` | `123456` |
| 学生 | `student1` | `123456` |

> 首次启动会自动建表并写入上面的测试账号，数据保存在 `backend/data/dev.sqlite`，删掉这个文件就会重置成全新系统。

---

## 五、完整模式：使用 MySQL（课程作业要求）

如果需要按作业要求使用 MySQL 8：

1. 本机装好并启动 MySQL 8；
2. 执行建库 SQL：

```sql
CREATE DATABASE classroom_monitor DEFAULT CHARACTER SET utf8mb4;
```

3. 编辑 `backend/.env`：把 `DB_DIALECT=sqlite` 那行注释掉，取消下面 MySQL 段的注释，并把 `DB_PASSWORD` 改成你自己的 MySQL 密码；
4. 重新 `npm run dev`。

---

## 六、常见问题（FAQ）

**Q1：双击 start.bat 一闪就没了？**
A：说明 Node.js 没装好，或没"新开"命令行窗口。请回到第一步确认 `node -v` 有输出。

**Q2：`npm install` 卡住或报错 ETIMEDOUT？**
A：网络问题。执行下面命令换成淘宝镜像后重试：
```bash
npm config set registry https://registry.npmmirror.com
```

**Q3：后端启动报 `EADDRINUSE: port 3000 already in use`？**
A：3000 端口被别的程序占了。编辑 `backend/.env`，把 `PORT=3000` 改成别的，比如 `PORT=3100`。

**Q4：前端打开页面是空白 / 一直加载？**
A：后端没起来。看后端那个终端窗口有没有红色报错；最常见是 `.env` 里 MySQL 密码没改。用懒人模式就不会遇到这个问题。

**Q5：数据存在哪？会上传到网上吗？**
A：不会。所有数据都在你自己电脑上的 `backend/data/dev.sqlite` 这一个文件里，关掉网络也能用。

**Q6：Windows 下 `cp .env.example .env` 报错？**
A：Windows 没有 `cp` 命令，用 `copy .env.example .env`，或者直接双击 `start.bat` 让脚本自动处理。

---

## 七、技术栈

- 前端：Vue 3 + Vite + Pinia + Vue Router + Element Plus + ECharts + Vant（移动端）
- 后端：Node.js + Express 5 + Sequelize ORM
- 数据库：SQLite（默认，零配置）/ MySQL 8（作业模式）
- 认证：JWT；实时：Socket.IO（弹幕）+ 1 秒轮询（通知）

## 八、目录结构

```
.
├── backend/                # 后端
│   ├── src/
│   │   ├── config/         # 数据库配置（MySQL / SQLite 自动切换）
│   │   ├── controllers/    # 业务控制器
│   │   ├── models/         # 数据模型（自动建表）
│   │   ├── routes/         # 接口路由
│   │   ├── middlewares/    # JWT 鉴权
│   │   ├── services/       # 业务服务
│   │   ├── socket/         # WebSocket 弹幕
│   │   ├── jobs/           # 定时任务
│   │   └── seed/           # 测试账号初始化
│   └── .env.example        # 配置模板
├── frontend/               # 前端（三端同一工程）
│   └── src/
│       ├── api/            # 接口封装
│       ├── views/          # student / teacher / admin 页面
│       ├── stores/         # Pinia 状态
│       └── router/         # 路由与权限守卫
├── start.sh                # Mac 一键启动
├── start.bat               # Windows 一键启动
└── README.md
```
