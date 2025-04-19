const express = require('express');
const router = express.Router();
const VideoModel = require('../models/video');
const Minio = require('minio');
const logger = require('../utils/logger');
const videoController = require('../controllers/video'); // 컨트롤러 추가

// Minio 클라이언트 설정
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT, 10),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
});

// 비디오 처리 진행률 확인 API
router.get('/video/progress/:id', videoController.getVideoProgress);

// 비디오 썸네일 가져오기
router.get('/thumbnail/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.debug({ videoId: id, userId: req.user?.id }, '썸네일 요청');

    const video = await VideoModel.findById(id);

    if (!video || !video.thumbnailPath) {
      logger.warn({ videoId: id, userId: req.user?.id }, '존재하지 않는 썸네일 요청');
      return res.status(404).send('썸네일을 찾을 수 없습니다.');
    }

    // MinIO에서 Presigned URL 생성
    const presignedUrl = await minioClient.presignedGetObject(
      process.env.MINIO_BUCKET,
      video.thumbnailPath,
      60 * 60 // 1시간 유효
    );

    logger.debug(
      { videoId: id, userId: req.user?.id, path: video.thumbnailPath },
      '썸네일 URL 생성 및 리디렉션'
    );
    // 클라이언트 리다이렉트
    res.redirect(presignedUrl);
  } catch (error) {
    logger.error(
      { err: error, videoId: req.params.id, userId: req.user?.id },
      '썸네일 요청 처리 중 오류 발생'
    );
    next(error);
  }
});

// 스트리밍 경로로 직접 비디오 파일 가져오기
router.get('/video/stream', async (req, res, next) => {
  try {
    const { path } = req.query;

    if (!path) {
      logger.warn({ userId: req.user?.id }, '경로 없는 비디오 스트리밍 요청');
      return res.status(400).send('비디오 경로가 제공되지 않았습니다.');
    }

    logger.debug({ path, userId: req.user?.id }, '경로로 비디오 스트리밍 요청');

    // MinIO에서 Presigned URL 생성
    const presignedUrl = await minioClient.presignedGetObject(
      process.env.MINIO_BUCKET,
      path,
      24 * 60 * 60 // 1일 유효
    );

    logger.debug({ path, userId: req.user?.id }, '비디오 스트리밍 URL 생성 및 리디렉션');

    // 클라이언트 리디렉트
    res.redirect(presignedUrl);
  } catch (error) {
    logger.error(
      { err: error, path: req.query.path, userId: req.user?.id },
      '경로 기반 비디오 스트리밍 요청 처리 중 오류 발생'
    );
    next(error);
  }
});

// 비디오 파일 가져오기
router.get('/video/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.debug({ videoId: id, userId: req.user?.id }, '비디오 스트리밍 요청');

    const video = await VideoModel.findById(id);

    if (!video || !video.filePath) {
      logger.warn({ videoId: id, userId: req.user?.id }, '존재하지 않는 비디오 스트리밍 요청');
      return res.status(404).send('비디오를 찾을 수 없습니다.');
    }

    // MinIO에서 Presigned URL 생성
    const presignedUrl = await minioClient.presignedGetObject(
      process.env.MINIO_BUCKET,
      video.filePath,
      24 * 60 * 60 // 1일 유효
    );

    logger.debug(
      { videoId: id, userId: req.user?.id, path: video.filePath },
      '비디오 스트리밍 URL 생성 및 리디렉션'
    );
    // 클라이언트 리디렉트
    res.redirect(presignedUrl);
  } catch (error) {
    logger.error(
      { err: error, videoId: req.params.id, userId: req.user?.id },
      '비디오 스트리밍 요청 처리 중 오류 발생'
    );
    next(error);
  }
});

module.exports = router;
