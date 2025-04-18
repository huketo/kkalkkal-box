const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');

// 회원가입 관련 라우트
router.get('/register', authController.getRegisterPage);
router.post('/register', authController.register);

// 로그인 관련 라우트
router.get('/login', authController.getLoginPage);
router.post('/login', authController.login);

// 로그아웃
router.get('/logout', authController.logout);

// 프로필 페이지
router.get('/profile', authController.getProfilePage);

module.exports = router;
