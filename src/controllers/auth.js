const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user');
const logger = require('../utils/logger');

/**
 * 회원가입 페이지 렌더링
 */
exports.getRegisterPage = (req, res) => {
  res.render('auth/register', {
    title: '회원가입 - 깔깔상자',
  });
};

/**
 * 회원가입 처리
 */
exports.register = async (req, res, next) => {
  try {
    const { username, password, confirmPassword, nickname } = req.body;

    // 필수 입력값 검증
    if (!username || !password || !confirmPassword || !nickname) {
      return res.status(400).render('auth/register', {
        title: '회원가입 - 깔깔상자',
        error: '모든 항목을 입력해주세요.',
        username,
        nickname,
      });
    }

    // 비밀번호 일치 여부 확인
    if (password !== confirmPassword) {
      return res.status(400).render('auth/register', {
        title: '회원가입 - 깔깔상자',
        error: '비밀번호와 비밀번호 확인이 일치하지 않습니다.',
        username,
        nickname,
      });
    }

    // 이미 존재하는 유저네임 확인
    const existingUser = await userModel.findByUsername(username);

    if (existingUser) {
      return res.status(400).render('auth/register', {
        title: '회원가입 - 깔깔상자',
        error: '이미 사용 중인 아이디입니다.',
        username,
        nickname,
      });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 12);

    // DB에 사용자 저장
    await userModel.create({
      username,
      password: hashedPassword,
      nickname,
    });

    // 로그인 페이지로 리다이렉트
    res.redirect('/auth/login?registered=true');
  } catch (error) {
    logger.error({ err: error }, '회원가입 처리 중 오류 발생');
    next(error);
  }
};

/**
 * 로그인 페이지 렌더링
 */
exports.getLoginPage = (req, res) => {
  const { registered } = req.query;
  res.render('auth/login', {
    title: '로그인 - 깔깔상자',
    registered,
  });
};

/**
 * 로그인 처리
 */
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 필수 입력값 검증
    if (!username || !password) {
      return res.status(400).render('auth/login', {
        title: '로그인 - 깔깔상자',
        error: '아이디와 비밀번호를 모두 입력해주세요.',
        username,
      });
    }

    // 사용자 조회
    const user = await userModel.findByUsername(username);

    if (!user) {
      return res.status(400).render('auth/login', {
        title: '로그인 - 깔깔상자',
        error: '아이디 또는 비밀번호가 일치하지 않습니다.',
        username,
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).render('auth/login', {
        title: '로그인 - 깔깔상자',
        error: '아이디 또는 비밀번호가 일치하지 않습니다.',
        username,
      });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { id: user.id, username: user.username, nickname: user.nickname },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 쿠키에 토큰 저장 (보안 강화)
    res.cookie('token', token, {
      httpOnly: true, // JavaScript에서 쿠키 접근 방지
      secure: process.env.NODE_ENV === 'production', // HTTPS에서만 쿠키 전송
      sameSite: 'strict', // CSRF 공격 방지
      maxAge: 24 * 60 * 60 * 1000, // 1일
      signed: true,
      path: '/', // 모든 경로에서 쿠키 접근 가능
    });

    // 메인 페이지로 리다이렉트
    res.redirect('/');
  } catch (error) {
    logger.error({ err: error }, '로그인 처리 중 오류 발생');
    next(error);
  }
};

/**
 * 로그아웃 처리
 */
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
};

/**
 * 프로필 페이지 처리
 */
exports.getProfilePage = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const user = await userModel.findById(req.user.id, { includeVideos: true });

    if (!user) {
      return res.redirect('/auth/login');
    }

    res.render('auth/profile', {
      title: `${user.nickname}님의 프로필 - 깔깔상자`,
      profileUser: user,
      user: req.user,
    });
  } catch (error) {
    logger.error({ err: error }, '프로필 페이지 로드 중 오류 발생');
    next(error);
  }
};
