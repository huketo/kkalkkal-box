const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const videoController = require('../controllers/video');

// 비디오 파일 업로드를 위한 multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/videos');

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 원본 파일명을 안전하게 처리
    let originalname = file.originalname;

    // 파일명 디코딩 시도 (URL 인코딩된 경우)
    try {
      originalname = decodeURIComponent(originalname);
    } catch (err) {
      // 디코딩 실패 시 원본 사용
    }

    // 안전한 이름으로 변환 (한글, 일본어, 중국어 등 멀티바이트 문자 지원)
    const timestamp = Date.now();
    const safeName = Buffer.from(originalname, 'utf8').toString('utf8');

    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB 제한
  fileFilter: (req, file, cb) => {
    // 비디오 파일 형식 필터링
    const allowedTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-matroska',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 비디오 형식입니다.'), false);
    }
  },
});

// 비디오 업로드 페이지
router.get('/upload', videoController.getUploadPage);

// 비디오 업로드 처리
router.post('/upload', upload.single('video'), videoController.uploadVideo);

// 비디오 수정 페이지
router.get('/:id/edit', videoController.getEditPage);

// 비디오 수정 처리
router.post('/:id/edit', videoController.updateVideo);

// 비디오 삭제 페이지
router.get('/:id/delete', videoController.getDeletePage);

// 비디오 삭제 처리
router.post('/:id/delete', videoController.deleteVideo);

// 비디오 인코딩 진행상태 확인 API
router.get('/:id/progress', videoController.getVideoProgress);

// 비디오 시청 페이지
router.get('/:id', videoController.getVideoPage);

module.exports = router;
