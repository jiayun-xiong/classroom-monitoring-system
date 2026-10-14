// Express 应用入口：中间件、路由挂载、健康检查
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// 中间件
app.use(cors()); // 开发阶段允许跨域，上线由 Nginx 同源代理
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查接口（环境搭建验收用）
app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    message: 'ok',
    data: {
      status: 'up',
      time: new Date().toISOString(),
    },
  });
});

// 业务路由挂载点（后续模块开发时逐个接入，如 /api/auth、/api/courses ...）
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api', require('./routes/checkins'));
app.use('/api', require('./routes/emotions'));
app.use('/api', require('./routes/homeworks'));
app.use('/api', require('./routes/surveys'));
app.use('/api', require('./routes/exams'));
app.use('/api', require('./routes/scores'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/notifications'));
app.use('/api', require('./routes/danmakus'));
app.use('/api', require('./routes/statsPeriods'));

// 404 兜底
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

module.exports = app;
