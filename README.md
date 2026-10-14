# 课堂学情监控管理系统

中国科学技术大学《高级软件工程》课程大作业。

面向课堂教学场景的三端系统（学生 / 教师 / 管理员），覆盖课堂签到、6 档表情反馈、随堂作业、学情调查、考试与加权成绩、课程学情报告、通知中心、讨论区与弹幕等功能，学生端适配移动端浏览器。

---

## 下载代码

**GitHub 仓库地址**：

```
https://github.com/jiayun-xiong/classroom-monitoring-system
```

### 方式一：直接下载 ZIP 压缩包（推荐新手）

1. 用浏览器打开上面的仓库地址；
2. 点页面绿色的 **`<> Code`** 按钮；
3. 在弹出的菜单里点 **`Download ZIP`**；
4. 下载完成后，把压缩包解压到一个**全英文路径**的文件夹里
   （例如 `D:\classroom-monitoring` 或 `~/projects/classroom-monitoring`，**路径里不要有中文和空格**）。

### 方式二：用 git 命令克隆（如果你装了 git）

```bash
git clone https://github.com/jiayun-xiong/classroom-monitoring-system.git
# ↑ git clone 是把整个仓库下载到本地的命令
# ↑ 后面那串是仓库地址；执行完会得到一个 classroom-monitoring-system 文件夹

cd classroom-monitoring-system
# ↑ 进入刚下载下来的项目文件夹，后面所有命令都在这个文件夹里执行
```

> 下载完成后，项目根目录里应该能看到 `backend/`、`frontend/`、`start.sh`、`start.bat` 这几个东西。确认你在这个目录里，再继续看下面的步骤。

---

## 一、你只需要准备一样东西：Node.js

> 完全新手看这一段就够了。本系统**不需要你装 MySQL**——默认用文件数据库（SQLite），解压即用。

| 需要安装 | 版本要求 | 下载地址 |
|---|---|---|
| **Node.js** | 20 或更高 | https://nodejs.org/zh-cn/download |

下载后双击安装包，全部一路点"继续 / 下一步"即可，不用改任何选项。

安装完成后，**新开一个终端（Mac 是"终端"App，Windows 是"命令提示符"）**，输入下面命令：

```bash
node -v
#  ↑ 这行命令的作用：查看当前装的 Node.js 版本号
#  ↓ 如果装成功了，终端会显示类似 v22.11.0 的字样，看到 v 开头的版本号就说明装好了
```

---

## 二、最快上手（推荐新手用这个）

### Mac 用户

打开"终端"，用 `cd` 命令进入项目文件夹后，执行：

```bash
bash start.sh
#  ↑ bash 是"用 bash 来运行一个脚本"的意思
#  ↑ start.sh 是项目根目录里那个一键启动脚本
#  它会自动完成：检查 Node → 生成配置 → 安装依赖 → 启动前后端
```

### Windows 用户

打开项目文件夹，**双击 `start.bat`**。

> 国内网络如果 `npm install` 很慢，可以先换国内镜像源再启动：
>
> ```bash
> npm config set registry https://registry.npmmirror.com
> # ↑ 这行命令的作用：把 npm 的下载地址从国外服务器换成淘宝镜像，下载速度会快很多
> ```

---

## 三、手动启动方式（想自己一步步看的）

如果你不想用脚本，也可以手动执行。打开**两个终端窗口**：

**窗口 1 —— 后端：**

```bash
cd backend
# ↑ cd 是"进入文件夹"的命令，这行是进入 backend 后端目录

cp .env.example .env
# ↑ cp 是"复制文件"的命令：把配置模板 .env.example 复制成真正生效的配置文件 .env
# ↓ Windows 没有 cp 命令，请改用下面这行：
# copy .env.example .env

npm install
# ↑ 下载后端需要的所有第三方代码库（第一次运行要等几分钟）

npm run dev
# ↑ 启动后端服务，启动后这个窗口就被占用了，不要关
```

**窗口 2 —— 前端：**

```bash
cd frontend
# ↑ 进入前端目录

npm install
# ↑ 下载前端需要的依赖

npm run dev
# ↑ 启动前端，看到 "Local: http://localhost:5173" 就是成功了
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
2. 打开 MySQL，执行下面的建库 SQL：

```sql
CREATE DATABASE classroom_monitor DEFAULT CHARACTER SET utf8mb4;
-- ↑ CREATE DATABASE 是 SQL 里"新建数据库"的命令
-- ↑ classroom_monitor 是数据库名
-- ↑ DEFAULT CHARACTER SET utf8mb4 表示用 utf8mb4 编码，这样才能正常存中文和 emoji
```

3. 用记事本编辑 `backend/.env`：把 `DB_DIALECT=sqlite` 那行前面加 `#`（注释掉），取消下面 MySQL 段每行前面的 `#`，并把 `DB_PASSWORD` 改成你自己的 MySQL 密码；
4. 重新 `npm run dev`。

---

## 六、常见问题（FAQ）

**Q1：双击 start.bat 一闪就没了？**
A：说明 Node.js 没装好。请回到第一步确认 `node -v` 有输出。

**Q2：`npm install` 卡住或报错 ETIMEDOUT？**
A：网络问题。执行下面命令换成淘宝镜像后重试：

```bash
npm config set registry https://registry.npmmirror.com
# ↑ 把 npm 的下载源换成国内镜像
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
├── backend/                # 后端（Node.js 服务，负责数据和接口）
│   ├── src/
│   │   ├── config/         # 数据库配置（MySQL / SQLite 自动切换）
│   │   ├── controllers/    # 业务逻辑：收到请求后干什么
│   │   ├── models/         # 数据表结构定义（自动建表）
│   │   ├── routes/         # 路由：什么网址对应哪个处理函数
│   │   ├── middlewares/    # 中间件：登录校验等通用处理
│   │   ├── services/       # 业务服务层
│   │   ├── socket/         # WebSocket：弹幕实时推送
│   │   ├── jobs/           # 定时任务
│   │   └── seed/           # 首次启动写入测试账号
│   └── .env.example        # 配置模板（复制成 .env 才生效）
├── frontend/               # 前端（三端同一套网页代码）
│   └── src/
│       ├── api/            # 封装调用后端接口的代码
│       ├── views/          # 各个页面（student / teacher / admin）
│       ├── stores/         # Pinia：全局状态管理（登录状态等）
│       └── router/         # 路由：网址和页面的对应关系
├── start.sh                # Mac 一键启动脚本
├── start.bat               # Windows 一键启动脚本
└── README.md               # 本说明文件
```
