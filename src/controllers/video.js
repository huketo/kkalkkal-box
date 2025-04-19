const videoModel = require('../models/video');
const logger = require('../utils/logger');
const Minio = require('minio');
const ffmpegUtils = require('../utils/ffmpeg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const videoQueue = require('../utils/videoQueue');

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
 * 안전한 파일명 생성
 * 모든 파일에 대해 일관되게 타임스탬프와 랜덤 문자열로 구성된 파일명 생성
 */
const generateSafeFileName = (originalFileName) => {
  try {
    // 원래 확장자 추출
    const ext = path.extname(originalFileName).toLowerCase();

    // 타임스탬프와 랜덤 문자열로 고유한 파일명 생성
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');

    // 항상 일관된 패턴의 파일명 반환 (원본 파일명 정보 무시)
    return `${timestamp}-${randomString}${ext}`;
  } catch (error) {
    logger.error({ err: error, originalFileName }, '파일명 처리 중 오류 발생');
    // 오류 발생 시 기본값 반환
    return `${Date.now()}-file${path.extname(originalFileName) || '.unknown'}`;
  }
};

/**
 * 파일 경로에서 파일명 추출 및 인코딩 이슈 해결
 * 경로에서 파일명만 추출하고 멀티바이트 문자 인코딩 문제 해결
 */
const getCleanFileName = (filePath) => {
  try {
    if (!filePath) return '알 수 없는 파일';

    // 파일 경로에서 파일명만 추출
    const fileName = path.basename(filePath);

    // 인코딩 이슈 복구 시도
    let decodedFileName;
    try {
      // URL 인코딩된 문자열 디코딩 시도
      decodedFileName = decodeURIComponent(fileName);
    } catch (err) {
      // 디코딩 실패 시 Buffer를 통한 복구 시도
      try {
        decodedFileName = Buffer.from(fileName, 'binary').toString('utf8');
      } catch (bufferErr) {
        // 모든 복구 시도 실패 시 원본 반환
        decodedFileName = fileName;
      }
    }

    return decodedFileName;
  } catch (error) {
    logger.error({ err: error, filePath }, '파일명 추출 및 복구 중 오류 발생');
    return path.basename(filePath || '알 수 없는 파일');
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

    // 원본 파일명에서 안전한 파일명 생성
    const safeFileName = generateSafeFileName(videoFile.originalname);
    const fileNameWithoutExt = path.basename(safeFileName, path.extname(safeFileName));

    // 비디오 정보 가져오기
    const videoInfo = await ffmpegUtils.getVideoInfo(localFilePath);

    logger.info(
      { filePath: localFilePath, originalName: videoFile.originalname },
      '동영상 파일 로컬에 저장 완료, 변환 작업 시작'
    );

    // 비디오 데이터 생성 (변환 전 기본 정보만)
    const video = await videoModel.create({
      title,
      description,
      originalFilePath: localFilePath, // 로컬 파일 경로를 originalFilePath로 저장
      filePath: null, // 변환 후 MinIO 경로를 위한 필드는 null로 초기화
      userId: req.user.id,
      tags: tagArray,
      originalInfo: {
        width: videoInfo.width,
        height: videoInfo.height,
        duration: videoInfo.duration,
        size: videoInfo.size,
        format: videoInfo.format,
        videoCodec: videoInfo.videoCodec,
        audioCodec: videoInfo.audioCodec,
      },
      conversionStatus: 'processing',
    });

    logger.info(
      { videoId: video.id, userId: req.user.id },
      '새 비디오 업로드 완료, 변환 큐에 추가'
    );

    // 비디오 처리 큐에 추가 (비동기 변환 작업 시작)
    videoQueue.addToQueue(video.id, processVideoAsync, [
      video.id,
      localFilePath,
      fileNameWithoutExt,
    ]);

    // 사용자를 비디오 페이지로 리디렉션
    res.redirect(`/video/${video.id}`);
  } catch (error) {
    logger.error({ err: error }, '비디오 업로드 처리 중 오류 발생');
    next(error);
  }
};

/**
 * 비동기 비디오 처리 (변환 및 썸네일 생성)
 */
const processVideoAsync = async (videoId, localFilePath, fileNameWithoutExt) => {
  try {
    // 변환 상태 업데이트
    await videoModel.findByIdAndUpdate(videoId, { conversionStatus: 'processing' });

    // 임시 디렉토리 경로
    const tempDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 1. 썸네일 생성
    logger.info({ videoId }, '썸네일 생성 시작');
    const thumbnailPath = await ffmpegUtils.generateThumbnail(
      localFilePath,
      tempDir,
      fileNameWithoutExt,
      videoId // 진행률 추적을 위한 videoId 추가
    );
    const minioThumbnailName = `thumbnails/${fileNameWithoutExt}_thumbnail.jpg`;

    // MinIO에 썸네일 업로드
    await minioClient.fPutObject(process.env.MINIO_BUCKET, minioThumbnailName, thumbnailPath, {
      'Content-Type': 'image/jpeg',
    });
    logger.info({ videoId, thumbnailPath: minioThumbnailName }, '썸네일 업로드 완료');

    // 2. 비디오 변환 (여러 해상도)
    logger.info({ videoId }, '비디오 변환 시작 (다중 해상도)');
    const convertedVideos = await ffmpegUtils.convertToWebM(
      localFilePath,
      tempDir,
      fileNameWithoutExt,
      videoId // 진행률 추적을 위한 videoId 추가
    );

    // 변환된 비디오 파일들을 MinIO에 업로드하고 정보 수집
    const formats = [];
    for (const resolution in convertedVideos) {
      const convertedVideo = convertedVideos[resolution];
      const minioVideoName = `videos/converted/${fileNameWithoutExt}_${resolution}.webm`;

      // MinIO에 변환된 비디오 업로드
      await minioClient.fPutObject(process.env.MINIO_BUCKET, minioVideoName, convertedVideo.path, {
        'Content-Type': 'video/webm',
      });

      // 포맷 정보 저장
      formats.push({
        resolution,
        filePath: minioVideoName,
        bitrate: convertedVideo.bitrate,
      });

      logger.info(
        { videoId, resolution, filePath: minioVideoName },
        `${resolution} 비디오 업로드 완료`
      );
    }

    // 3. 데이터베이스 업데이트 - 첫 번째 형식(가장 낮은 해상도)을 기본 스트리밍 소스로 설정
    const defaultFormat = formats.length > 0 ? formats[0].filePath : null;
    await videoModel.findByIdAndUpdate(videoId, {
      thumbnailPath: minioThumbnailName,
      filePath: defaultFormat, // 원본 로컬 파일 경로를 MinIO의 변환된 파일 경로로 업데이트
      formats,
      conversionStatus: 'completed',
    });
    logger.info({ videoId }, '비디오 처리 완료');

    // 4. 파일 정리
    try {
      // 임시 변환 파일들 삭제
      fs.unlinkSync(thumbnailPath);
      for (const resolution in convertedVideos) {
        fs.unlinkSync(convertedVideos[resolution].path);
      }

      // 원본 로컬 파일 삭제
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        logger.info({ videoId, originalFilePath: localFilePath }, '원본 동영상 파일 삭제 완료');
      }

      logger.debug({ videoId }, '임시 파일 정리 완료');
    } catch (cleanupError) {
      logger.warn({ err: cleanupError }, '임시 파일 정리 중 오류 발생');
    }
  } catch (error) {
    logger.error({ err: error, videoId }, '비디오 처리 중 오류 발생');
    // 오류 발생 시 상태 업데이트
    await videoModel.findByIdAndUpdate(videoId, { conversionStatus: 'failed' });
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

    // 원본 파일명 복구 (인코딩 문제 해결)
    if (video.originalFilePath) {
      video.originalFileName = getCleanFileName(video.originalFilePath);
    }

    // 큐에서 현재 진행 상태 가져오기
    const progressInfo = videoQueue.getProgress(id);

    // 변환이 완료되었거나, 일부 화질이 완료되어 시청 가능한 경우
    if (
      video.conversionStatus === 'completed' ||
      (video.formats && video.formats.length > 0) ||
      (progressInfo && progressInfo.visible === true)
    ) {
      // 비디오 URL 및 포맷 정보 설정
      let videoUrl;
      let selectedFormat;
      let thumbnailUrl = null;

      // 포맷 배열이 있으면 첫 번째 포맷(가장 낮은 해상도) 사용
      if (video.formats && video.formats.length > 0) {
        selectedFormat = video.formats[0];
        videoUrl = await getMinioUrl(selectedFormat.filePath);
      } else if (video.filePath) {
        // 기본 filePath가 있는 경우
        videoUrl = await getMinioUrl(video.filePath);
      }

      // 썸네일이 있는 경우 썸네일 URL도 생성
      if (video.thumbnailPath) {
        thumbnailUrl = await getMinioUrl(video.thumbnailPath);
      }

      // 비디오 객체에 URL 정보 추가
      video.videoUrl = videoUrl;
      video.thumbnailUrl = thumbnailUrl;
      video.selectedFormat = selectedFormat;

      // watch 페이지로 렌더링
      return res.render('video/watch', {
        title: `${video.title} - 깔깔상자`,
        video,
        user: req.user,
      });
    } else {
      // 변환된 형식이 없고 아직 시청 불가능한 경우
      // 업로드한 사용자만 처리 페이지에 접근 가능하도록 체크
      if (!req.user || req.user.id !== video.userId.toString()) {
        logger.warn(
          { videoId: id, userId: req.user ? req.user.id : 'guest', uploaderId: video.userId },
          '비디오 처리 중 - 권한 없는 사용자 접근 시도'
        );
        const error = new Error('아직 처리 중인 비디오입니다. 나중에 다시 시도해주세요.');
        error.status = 403;
        return next(error);
      }

      res.render('video/processing', {
        title: '비디오 처리 중 - 깔깔상자',
        video: {
          id: video.id,
          title: video.title,
          description: video.description,
          conversionStatus: video.conversionStatus,
          createdAt: video.createdAt,
        },
        progressInfo: progressInfo, // 진행 정보 전달
        user: req.user,
      });
    }
  } catch (error) {
    logger.error({ err: error, videoId: req.params.id }, '비디오 페이지 로드 중 오류 발생');
    next(error);
  }
};

/**
 * 비디오 처리 상태 확인 API
 */
exports.getVideoProgress = async (req, res, _next) => {
  try {
    const { id } = req.params;

    // DB에서 비디오 정보 가져오기
    const video = await videoModel.findById(id);

    if (!video) {
      return res.status(404).json({ error: '비디오를 찾을 수 없습니다.' });
    }

    // 진행 중인 비디오에 대한 접근 권한 확인 - JWT 토큰의 사용자 ID 검증
    if (video.conversionStatus !== 'completed') {
      // 1. JWT 토큰이 있는지 확인
      if (!req.user) {
        logger.warn({ videoId: id }, '비인증 사용자의 비디오 진행 상태 조회 시도');
        return res.status(403).json({ error: '인증 후 접근 가능합니다.', needsAuth: true });
      }

      // 2. 비디오 업로더 확인
      if (req.user.id !== video.userId.toString()) {
        logger.warn(
          { videoId: id, userId: req.user.id, videoOwnerId: video.userId },
          '타인의 처리 중인 비디오 진행 상태 조회 시도'
        );
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
      }
    }

    // 큐에서 현재 진행 상태 가져오기
    const progressInfo = videoQueue.getProgress(id);

    // 비디오 상태 확인
    if (video.conversionStatus === 'completed') {
      // 이미 완료된 경우, 시청 페이지로 리다이렉트 정보 제공
      return res.json({
        status: 'completed',
        progress: 100,
        message: '처리 완료',
        redirectUrl: `/video/${id}`,
      });
    } else if (video.conversionStatus === 'failed') {
      // 실패한 경우
      return res.json({
        status: 'failed',
        progress: 0,
        message: '처리 중 오류가 발생했습니다',
      });
    }

    // 처리 중인 경우 progressInfo 반환
    return res.json(progressInfo);
  } catch (error) {
    logger.error({ err: error, videoId: req.params.id }, '비디오 진행상태 조회 중 오류 발생');
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
};

/**
 * 비디오 수정 페이지 렌더링
 */
exports.getEditPage = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const { id } = req.params;
    const video = await videoModel.findById(id);

    if (!video) {
      const error = new Error('비디오를 찾을 수 없습니다.');
      error.status = 404;
      return next(error);
    }

    // 비디오 소유자 확인
    if (req.user.id !== video.userId.toString()) {
      const error = new Error('권한이 없습니다.');
      error.status = 403;
      return next(error);
    }

    // 태그 문자열로 변환
    const tagString = video.tags.join(', ');

    // 인코딩 진행 상태 가져오기
    const progressInfo = videoQueue.getProgress(id);

    res.render('video/edit', {
      title: `${video.title} 수정 - 깔깔상자`,
      video,
      tagString,
      progressInfo,
      user: req.user,
    });
  } catch (error) {
    logger.error({ err: error, videoId: req.params.id }, '비디오 수정 페이지 로드 중 오류 발생');
    next(error);
  }
};

/**
 * 비디오 수정 처리
 */
exports.updateVideo = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const { id } = req.params;
    const { title, description, tags } = req.body;

    // 필수 필드 확인
    if (!title || !description) {
      return res.status(400).render('video/edit', {
        title: '비디오 수정 - 깔깔상자',
        error: '제목과 설명은 필수입니다.',
        video: { _id: id, title, description },
        tagString: tags,
        user: req.user,
      });
    }

    // 비디오 존재 확인
    const video = await videoModel.findById(id);
    if (!video) {
      const error = new Error('비디오를 찾을 수 없습니다.');
      error.status = 404;
      return next(error);
    }

    // 비디오 소유자 확인
    if (req.user.id !== video.userId.toString()) {
      const error = new Error('권한이 없습니다.');
      error.status = 403;
      return next(error);
    }

    // 태그 처리
    const tagArray = tags ? tags.split(',').map((tag) => tag.trim()) : [];

    // 비디오 업데이트
    await videoModel.findByIdAndUpdate(id, {
      title,
      description,
      tags: tagArray,
    });

    logger.info({ videoId: id, userId: req.user.id }, '비디오 정보 업데이트 완료');

    // 비디오 페이지로 리디렉션
    res.redirect(`/video/${id}`);
  } catch (error) {
    logger.error({ err: error, videoId: req.params.id }, '비디오 수정 처리 중 오류 발생');
    next(error);
  }
};

/**
 * 비디오 삭제 페이지 렌더링
 */
exports.getDeletePage = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const { id } = req.params;
    const video = await videoModel.findById(id);

    if (!video) {
      const error = new Error('비디오를 찾을 수 없습니다.');
      error.status = 404;
      return next(error);
    }

    // 비디오 소유자 확인
    if (req.user.id !== video.userId.toString()) {
      const error = new Error('권한이 없습니다.');
      error.status = 403;
      return next(error);
    }

    res.render('video/delete', {
      title: `${video.title} 삭제 - 깔깔상자`,
      video,
      user: req.user,
    });
  } catch (error) {
    logger.error({ err: error, videoId: req.params.id }, '비디오 삭제 페이지 로드 중 오류 발생');
    next(error);
  }
};

/**
 * 비디오 삭제 처리
 */
exports.deleteVideo = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const { id } = req.params;

    // 비디오 존재 확인
    const video = await videoModel.findById(id);
    if (!video) {
      const error = new Error('비디오를 찾을 수 없습니다.');
      error.status = 404;
      return next(error);
    }

    // 비디오 소유자 확인
    if (req.user.id !== video.userId.toString()) {
      const error = new Error('권한이 없습니다.');
      error.status = 403;
      return next(error);
    }

    // MinIO에서 관련 파일 삭제
    try {
      // 썸네일 삭제
      if (video.thumbnailPath) {
        await minioClient.removeObject(process.env.MINIO_BUCKET, video.thumbnailPath);
        logger.info({ videoId: id, thumbnailPath: video.thumbnailPath }, '썸네일 삭제 완료');
      }

      // 변환된 비디오 파일 삭제
      if (video.formats && video.formats.length > 0) {
        for (const format of video.formats) {
          await minioClient.removeObject(process.env.MINIO_BUCKET, format.filePath);
          logger.info(
            { videoId: id, filePath: format.filePath, resolution: format.resolution },
            `${format.resolution} 비디오 파일 삭제 완료`
          );
        }
      }
    } catch (storageError) {
      // 파일 삭제 실패 기록
      logger.warn(
        { err: storageError, videoId: id },
        'MinIO에서 비디오 관련 파일 삭제 중 오류 발생'
      );
      // 파일 삭제 실패해도 DB에서는 삭제 진행
    }

    // 비디오 삭제
    await videoModel.findByIdAndDelete(id);
    logger.info({ videoId: id, userId: req.user.id }, '비디오 삭제 완료');

    // 홈페이지로 리디렉션
    res.redirect('/');
  } catch (error) {
    logger.error({ err: error, videoId: req.params.id }, '비디오 삭제 처리 중 오류 발생');
    next(error);
  }
};
