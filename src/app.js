const express = require('express');
const path = require('path');
const nunjucks = require('nunjucks');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const logger = require('./utils/logger');
const dayjs = require('dayjs');

// 환경변수 설정 - .env 파일 로드
logger.info('환경 설정 파일 로드: .env');
dotenv.config();

// MongoDB 연결 (Mongoose 사용)
require('./utils/mongoose');
logger.info('MongoDB 연결 설정 완료');

// 라우터 가져오기
const indexRouter = require('./routes');
const authRouter = require('./routes/auth');
const videoRouter = require('./routes/video');
const apiRouter = require('./routes/api');

// 인증 미들웨어 가져오기
const { verifyToken } = require('./middlewares/auth');

const app = express();

// 뷰 엔진 설정
app.set('view engine', 'html');
const nunjucksEnv = nunjucks.configure('views', {
  express: app,
  watch: true,
  autoescape: true,
});

// 커스텀 필터 추가
nunjucksEnv.addFilter('date', function (date, format) {
  if (!date) return '';
  return dayjs(date).format(format || 'YYYY-MM-DD');
});

// 미들웨어 설정
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));

logger.info('애플리케이션 미들웨어 설정 완료');

// 인증 미들웨어 적용 - 모든 요청에서 토큰 검증
app.use(verifyToken);

// 라우터 설정
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/video', videoRouter);
app.use('/api', apiRouter);

logger.info('라우터 설정 완료');

// 404 에러 처리
app.use((req, res, next) => {
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  logger.warn({ method: req.method, url: req.url }, '존재하지 않는 라우터 요청');
  next(error);
});

// 에러 처리 미들웨어
app.use((err, req, res, _next) => {
  // 로그에만 상세 오류 기록 (관리자만 볼 수 있음)
  logger.error(
    {
      err: {
        type: err.name,
        message: err.message,
        code: err.code,
        status: err.status || 500,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      method: req.method,
      url: req.url,
      status: err.status || 500,
    },
    '오류 발생'
  );

  // 사용자에게 보여줄 안전한 오류 메시지
  const userFriendlyMessage =
    process.env.NODE_ENV === 'production'
      ? '서비스 이용 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      : err.message;

  res.locals.message = userFriendlyMessage;
  // 개발 환경에서만 디버깅 정보 포함
  res.locals.error =
    process.env.NODE_ENV !== 'production'
      ? {
          message: err.message,
          status: err.status || 500,
        }
      : {};
  res.locals.status = err.status || 500;

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
