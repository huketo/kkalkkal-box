const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

// 개발 환경에서 쿼리 로깅을 위한 설정
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 연결 이벤트 핸들링
prisma
  .$connect()
  .then(() => {
    logger.info('Prisma 데이터베이스 연결 성공');
  })
  .catch((error) => {
    logger.error({ err: error }, 'Prisma 데이터베이스 연결 실패');
    process.exit(1);
  });

// 애플리케이션 종료 시 연결 해제
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  logger.info('Prisma 데이터베이스 연결 해제');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  logger.info('Prisma 데이터베이스 연결 해제');
  process.exit(0);
});

module.exports = prisma;
