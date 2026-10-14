@echo off
chcp 65001 >nul
REM ============================================================
REM 一键启动脚本（Windows）
REM 双击本文件即可
REM ============================================================
cd /d "%~dp0"

echo ==> [1/3] 检查 Node.js ...
where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js 20+ ：https://nodejs.org/zh-cn/download
  pause
  exit /b 1
)
node -v

echo ==> [2/3] 准备配置并安装依赖（首次运行需要几分钟）...
cd backend
if not exist .env (
  copy .env.example .env >nul
  echo 已自动生成 .env（默认 SQLite 懒人模式，无需 MySQL）
)
call npm install
cd ..\frontend
call npm install

echo ==> [3/3] 启动服务 ...
REM 后端开新窗口
start "课堂学情-后端" cmd /k "cd /d %~dp0backend && npm run dev"
REM 等后端先起来
timeout /t 3 /nobreak >nul
REM 前端开新窗口
start "课堂学情-前端" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================================
echo  正在启动，浏览器打开：
echo    学生端  http://localhost:5173/student
echo    教师端  http://localhost:5173/teacher
echo    管理端  http://localhost:5173/admin
echo  测试账号  admin/admin123  teacher1/123456  student1/123456
echo  关闭两个弹出的黑色窗口即可停止服务
echo ============================================================
echo.
timeout /t 5 /nobreak >nul
start http://localhost:5173/teacher
