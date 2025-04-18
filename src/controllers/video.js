const videoModel = require('../models/video');
const logger = require('../utils/logger');
const Minio = require('minio');

// Minio 클라이언트 설정
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT, 10),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
});

/**
 * MinIO 버킷 존재 여부 확인 및 생성
 */
const ensureBucket = async (bucketName) => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      logger.info(`MinIO 버킷 ${bucketName} 생성 시작`);
      await minioClient.makeBucket(bucketName);
      logger.info(`MinIO 버킷 ${bucketName} 생성 완료`);
    }
  } catch (error) {
    logger.error({ err: error }, `MinIO 버킷 ${bucketName} 확인/생성 중 오류 발생`);
    throw error;
  }
};

/**
 * MinIO 비디오 URL 생성
 */
const getMinioUrl = async (objectName) => {
  try {
    // presigned URL을 사용하여 임시 접근 권한이 있는 URL 생성 (24시간 유효)
    return await minioClient.presignedGetObject(process.env.MINIO_BUCKET, objectName, 24 * 60 * 60);
  } catch (error) {
    logger.error({ err: error }, `MinIO URL 생성 중 오류 발생`);
    throw error;
  }
};

/**
 * 비디오 업로드 페이지 렌더링
 */
exports.getUploadPage = (req, res) => {
  if (!req.user) {
    return res.redirect('/auth/login');
  }

  res.render('video/upload', {
    title: '비디오 업로드 - 깔깔상자',
    user: req.user,
  });
};

/**
 * 비디오 업로드 처리
 */
exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const { title, description, tags } = req.body;
    const videoFile = req.file;

    if (!title || !description || !videoFile) {
      return res.status(400).render('video/upload', {
        title: '비디오 업로드 - 깔깔상자',
        error: '제목, 설명, 비디오 파일은 필수입니다.',
        formData: { title, description, tags },
        user: req.user,
      });
    }

    // 태그 처리
    const tagArray = tags ? tags.split(',').map((tag) => tag.trim()) : [];

    // MinIO 버킷 확인 및 생성
    await ensureBucket(process.env.MINIO_BUCKET);

    // 파일 경로 및 이름 설정
    const localFilePath = videoFile.path;
    const minioObjectName = `videos/${videoFile.filename}`;

    // MinIO에 파일 업로드
    logger.info(
      { filePath: localFilePath, destination: minioObjectName },
      'MinIO에 비디오 파일 업로드 시작'
    );

    await minioClient.fPutObject(process.env.MINIO_BUCKET, minioObjectName, localFilePath, {
      'Content-Type': videoFile.mimetype,
    });

    logger.info(
      { filePath: localFilePath, destination: minioObjectName },
      'MinIO에 비디오 파일 업로드 완료'
    );

    // 비디오 데이터 생성
    const video = await videoModel.create({
      title,
      description,
      filePath: minioObjectName,
      userId: req.user.id,
      tags: tagArray,
    });

    logger.info({ videoId: video.id, userId: req.user.id }, '새 비디오 업로드 완료');

    res.redirect(`/video/${video.id}`);
  } catch (error) {
    logger.error({ err: error }, '비디오 업로드 처리 중 오류 발생');
    next(error);
  }
};

/**
 * 비디오 시청 페이지 처리
 */
exports.getVideoPage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await videoModel.findById(id);

    if (!video) {
      logger.warn({ videoId: id }, '존재하지 않는 비디오 접근 시도');
      const error = new Error('비디오를 찾을 수 없습니다.');
      error.status = 404;
      return next(error);
    }

    // MinIO에서 비디오 URL 생성
    const videoUrl = await getMinioUrl(video.filePath);

    // 썸네일이 있는 경우 썸네일 URL도 생성
    let thumbnailUrl = null;
    if (video.thumbnailPath) {
      thumbnailUrl = await getMinioUrl(video.thumbnailPath);
    }

    // 비디오 객체에 URL 정보 추가
    video.videoUrl = videoUrl;
    video.thumbnailUrl = thumbnailUrl;

    res.render('video/watch', {
      title: `${video.title} - 깔깔상자`,
      video,
      user: req.user,
    });
  } catch (error) {
    logger.error({ err: error, videoId: req.params.id }, '비디오 페이지 로드 중 오류 발생');
    next(error);
  }
};
