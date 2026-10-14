#!/bin/bash
# ============================================================
# 文件作用：Mac / Linux 一键启动脚本
# 用法：在终端里执行  bash start.sh
# 它会自动完成：检查 Node → 生成配置 → 装依赖 → 启动前后端
# ============================================================

# set -e 表示：脚本里任何一条命令失败，就立刻停止整个脚本，不继续往下跑
set -e

# cd 到脚本所在的目录（也就是项目根目录），保证后面的相对路径都对
# $0 是脚本自己的路径，dirname 取出它所在的文件夹
cd "$(dirname "$0")"

# echo 是在终端打印文字，==> [1/4] 这种是进度提示
echo "==> [1/4] 检查 Node.js ..."

# command -v node 会查找 node 命令是否存在；
# >/dev/null 2>&1 把查找结果的输出扔掉，我们只看成功还是失败
# ! 是取反：如果没找到 node，就进入 if 分支
if ! command -v node >/dev/null 2>&1; then
  # 没装 Node，打印提示并退出（exit 1 表示异常退出）
  echo "未检测到 Node.js，请先安装 Node.js 20+ ：https://nodejs.org/zh-cn/download"
  exit 1
fi

# 装好了就打印版本号，让用户确认
node -v

echo "==> [2/4] 准备后端配置 ..."
# 进入后端目录
cd backend

# 判断 .env 文件是否存在；! -f 表示"不是一个文件"（即不存在）
if [ ! -f .env ]; then
  # 不存在就从模板复制一份，新手就不用手动改了
  cp .env.example .env
  echo "已自动生成 .env（默认使用 SQLite 懒人模式，无需 MySQL）"
fi

echo "==> [3/4] 安装依赖（首次运行需要几分钟）..."
# npm install 会读 package.json，把里面列的所有第三方库下载到 node_modules 文件夹
npm install

echo "==> [4/4] 启动服务 ..."
# 启动后端：node src/server.js，> backend.log 把输出写到日志文件，2>&1 把错误信息也写进去
# 行尾的 & 表示放到后台运行，这样脚本不会被卡住，能继续往下启动前端
node src/server.js > backend.log 2>&1 &

# $! 是上一个后台进程的进程号（PID），存下来待会用来关掉它
BACK_PID=$!

# trap 是"捕获退出信号"：当用户按 Ctrl+C 或脚本正常结束时，自动执行后面的命令
# 这里保证：前端一停，后端也一起停，不会留个后台进程占端口
trap "kill $BACK_PID 2>/dev/null; echo; echo '已停止服务'" EXIT INT TERM

# sleep 3 是等待 3 秒，让后端先把数据库建好、端口起来
sleep 3

# 打印一个漂亮的提示框，告诉用户怎么访问系统
echo ""
echo "============================================================"
echo "  启动成功！浏览器打开下面地址："
echo "    学生端  http://localhost:5173/student"
echo "    教师端  http://localhost:5173/teacher"
echo "    管理端  http://localhost:5173/admin"
echo "  测试账号  admin/admin123  teacher1/123456  student1/123456"
echo "  按 Ctrl+C 停止"
echo "============================================================"
echo ""

# 回到项目根目录下的 frontend 文件夹
cd ../frontend

# 前端也装一下依赖（第一次才会真的下载，之后秒过）
npm install

# npm run dev 启动 Vite 前端开发服务器；这一行不加 &，放前台运行
# 用户按 Ctrl+C 时会触发上面的 trap，把后端一起关掉
npm run dev
