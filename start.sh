#!/bin/bash
# ============================================================
# 一键启动脚本（macOS / Linux）
# 双击或在终端执行：bash start.sh
# 它会自动：检查 Node → 准备配置 → 安装依赖 → 启动前后端
# ============================================================
set -e
cd "$(dirname "$0")"

echo "==> [1/4] 检查 Node.js ..."
if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 20+ ：https://nodejs.org/zh-cn/download"
  exit 1
fi
node -v

echo "==> [2/4] 准备后端配置 ..."
cd backend
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已自动生成 .env（默认使用 SQLite 懒人模式，无需 MySQL）"
fi

echo "==> [3/4] 安装依赖（首次运行需要几分钟）..."
npm install

echo "==> [4/4] 启动服务 ..."
# 后端放后台，日志写文件
node src/server.js > backend.log 2>&1 &
BACK_PID=$!
# 退出时一起关掉后端
trap "kill $BACK_PID 2>/dev/null; echo; echo '已停止服务'" EXIT INT TERM

# 等后端起来
sleep 3
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

# 前端放前台（Ctrl+C 会触发上面的 trap 关掉后端）
cd ../frontend
npm install
npm run dev
