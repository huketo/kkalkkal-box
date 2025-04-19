const mongoose = require('mongoose');
const logger = require('./logger');

// MongoDB 연결 설정
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    logger.info('MongoDB 데이터베이스 연결 성공');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB 데이터베이스 연결 실패');
    process.exit(1);
  }
};

// 초기 연결
connectDB();

// 연결 이벤트 핸들링
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB 연결이 끊어졌습니다. 재연결 시도 중...');
  connectDB();
});

// 애플리케이션 종료 시 연결 해제
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB 데이터베이스 연결 해제');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB 데이터베이스 연결 해제');
  process.exit(0);
});

module.exports = mongoose;
