@echo off
REM ============================================================
REM 文件作用：Windows 一键启动脚本
REM 用法：直接双击本文件即可
REM ============================================================

REM chcp 65001 把命令行编码切成 UTF-8，避免中文乱码；>nul 把切换提示也藏掉
chcp 65001 >nul

REM cd /d 切换到脚本所在目录；%~dp0 是脚本所在文件夹（带盘符和结尾反斜杠）
REM /d 表示允许同时切换盘符
cd /d "%~dp0"

echo ==> [1/3] 检查 Node.js ...
REM where node 查找 node 命令是否在系统路径里
where node >nul 2>nul
REM errorlevel 1 表示上一条命令没找到；如果没找到就跳过去提示
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js 20+ ：https://nodejs.org/zh-cn/download
  REM pause 会停在"请按任意键继续..."，让用户能看到提示而不是窗口一闪而过
  pause
  exit /b 1
)
REM 打印 Node 版本号
node -v

echo ==> [2/3] 准备配置并安装依赖（首次运行需要几分钟）...
REM 进入后端目录
cd backend
REM if not exist 判断文件是否不存在；不存在就从模板复制一份
if not exist .env (
  REM copy 是 Windows 的复制命令；>nul 不显示"已复制 1 个文件"这种提示
  copy .env.example .env >nul
  echo 已自动生成 .env（默认 SQLite 懒人模式，无需 MySQL）
)
REM call 用来调用另一个批处理命令（npm 本身是个 .cmd 脚本，不加 call 会导致当前脚本执行完就退出）
call npm install
REM 切到前端目录
cd ..\frontend
call npm install

echo ==> [3/3] 启动服务 ...
REM start "窗口标题" cmd /k "命令" 会新开一个黑色命令行窗口并执行命令
REM 后端单独开一个窗口，这样两个服务分开看日志
start "课堂学情-后端" cmd /k "cd /d %~dp0backend && npm run dev"

REM timeout 是 Windows 的等待命令，/t 3 等 3 秒，/nobreak 让用户按任意键不能跳过
REM 目的：让后端先启动起来，再开前端
timeout /t 3 /nobreak >nul

REM 前端也单独开一个窗口
start "课堂学情-前端" cmd /k "cd /d %~dp0frontend && npm run dev"

REM 打印访问提示
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

REM 再等 5 秒，让用户看清提示
timeout /t 5 /nobreak >nul

REM 自动打开默认浏览器，直接进入教师端
start http://localhost:5173/teacher
