const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT 토큰을 확인하고 사용자 정보를 req.user에 추가하는 미들웨어
const verifyToken = (req, res, next) => {
  try {
    const token = req.signedCookies.token;

    if (!token) {
      return next(); // 토큰이 없으면 인증되지 않은 상태로 계속 진행
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // 토큰에서 추출한 사용자 정보를 req.user에 저장
    logger.debug({ userId: decoded.id, username: decoded.username }, '사용자 인증 성공');
    return next();
  } catch (error) {
    // 토큰이 유효하지 않으면 쿠키 제거 후 계속 진행
    logger.warn({ err: error }, '유효하지 않은 토큰, 쿠키 제거');
    res.clearCookie('token');
    return next();
  }
};

// 로그인 확인 미들웨어 - 로그인이 필요한 라우트에서 사용
const isLoggedIn = (req, res, next) => {
  if (req.user) {
    logger.debug({ userId: req.user.id, username: req.user.username }, '인증된 사용자 접근');
    next();
  } else {
    logger.debug(
      { path: req.originalUrl },
      '비인증 사용자의 보호된 라우트 접근 시도, 로그인 페이지로 리디렉션'
    );
    res.redirect('/auth/login');
  }
};

// 로그인하지 않은 사용자만 접근 가능한 라우트에서 사용 (회원가입, 로그인 페이지 등)
const isNotLoggedIn = (req, res, next) => {
  if (!req.user) {
    logger.debug({ path: req.originalUrl }, '비인증 사용자 접근');
    next();
  } else {
    logger.debug(
      { userId: req.user.id, username: req.user.username, path: req.originalUrl },
      '이미 인증된 사용자의 접근, 메인 페이지로 리디렉션'
    );
    res.redirect('/');
  }
};

module.exports = {
  verifyToken,
  isLoggedIn,
  isNotLoggedIn,
};
