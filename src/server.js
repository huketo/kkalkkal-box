#!/usr/bin/env node

const app = require('./app');
const http = require('http');
const logger = require('./utils/logger');

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

const server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// 프로세스 종료 이벤트 처리
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
    logger.fatal({ err: error }, '서버 에러 발생');
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      logger.fatal({ bind }, `${bind} 권한 오류: 높은 권한이 필요합니다`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.fatal({ bind }, `${bind} 이미 사용 중인 포트입니다`);
      process.exit(1);
      break;
    default:
      logger.fatal({ err: error }, '알 수 없는 서버 에러');
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  logger.info(
    { port: addr.port, env: process.env.NODE_ENV || 'development' },
    `깔깔상자 서버가 ${bind}에서 실행 중입니다`
  );
}

function gracefulShutdown() {
  server.close(() => {
    process.exit(0);
  });

  // 10초 후에도 종료되지 않으면 강제 종료
  setTimeout(() => {
    process.exit(1);
  }, 10000);
}
