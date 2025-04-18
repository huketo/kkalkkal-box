const express = require('express');
const router = express.Router();
const indexController = require('../controllers/index');

// 메인 페이지 - 최신 비디오 목록 표시
router.get('/', indexController.getHomePage);

// 검색 기능
router.get('/search', indexController.search);

module.exports = router;
