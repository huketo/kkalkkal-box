/**
 * FFmpeg 유틸리티 함수
 * 비디오 파일 변환 및 썸네일 생성 기능 제공
 */
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const videoQueue = require('./videoQueue');

/**
 * 비디오를 WebM 포맷으로 변환 (VP9 코덱)
 * 다양한 해상도로 변환하여 각각 다른 파일로 저장
 *
 * @param {string} inputPath 입력 비디오 파일 경로
 * @param {string} outputDir 출력 디렉토리
 * @param {string} filename 출력 파일명 (확장자 제외)
 * @param {string} videoId 비디오 ID (진행률 추적용)
 * @returns {Promise<Object>} 변환된 파일의 정보
 */
exports.convertToWebM = async (inputPath, outputDir, filename, videoId) => {
  // 출력 디렉토리가 없으면 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 해상도별 비트레이트 설정 (낮은 해상도부터 처리하도록 순서 변경)
  const resolutions = [
    { height: 144, bitrate: '100k', suffix: '144p' },
    { height: 240, bitrate: '200k', suffix: '240p' },
    { height: 360, bitrate: '400k', suffix: '360p' },
    { height: 480, bitrate: '600k', suffix: '480p' },
  ];

  const results = {};
  const totalResolutions = resolutions.length;
  let completedResolutions = 0;
  let isAnyResolutionCompleted = false; // 최소 하나의 해상도라도 완료되었는지 추적

  for (const resolution of resolutions) {
    const outputPath = path.join(outputDir, `${filename}_${resolution.suffix}.webm`);

    // 큐에 저장된 진행상태 업데이트
    videoQueue.setProgress(videoId, {
      status: 'processing',
      progress: Math.floor((completedResolutions / totalResolutions) * 100),
      message: `해상도 ${resolution.suffix} 변환 시작...`,
      resolution: resolution.suffix,
      currentStep: completedResolutions + 1,
      totalSteps: totalResolutions,
      visible: isAnyResolutionCompleted, // 하나라도 완료된 해상도가 있으면 노출 가능
    });

    results[resolution.suffix] = await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOption('-c:v libvpx-vp9') // VP9 코덱 사용
        .outputOption('-c:a libopus') // Opus 오디오 코덱
        .outputOption('-b:v ' + resolution.bitrate) // 비디오 비트레이트
        .outputOption('-r 30') // 30fps
        .outputOption('-vf', `scale=-1:${resolution.height},setdar=4/3`) // 4:3 비율 설정
        .outputOption('-deadline good') // 인코딩 품질/속도 밸런스
        .outputOption('-cpu-used 2') // CPU 사용량 (0-5, 높을수록 빠르지만 품질 저하)
        .outputOption('-row-mt 1') // 멀티스레딩 활성화
        .outputOption('-tile-columns 2') // 타일링 사용
        .outputOption('-threads 4') // 스레드 수
        .on('start', (commandLine) => {
          logger.debug(
            { commandLine, resolution: resolution.suffix },
            `${resolution.suffix} 변환 시작`
          );
        })
        .on('progress', (progress) => {
          // 해상도별 진행률 계산 및 업데이트
          const resolutionProgress = Math.floor(progress.percent || 0);
          const overallProgress = Math.floor(
            (completedResolutions * 100 + resolutionProgress) / totalResolutions
          );

          // 큐에 진행상태 업데이트
          videoQueue.setProgress(videoId, {
            status: 'processing',
            progress: overallProgress,
            message: `${resolution.suffix} 변환 진행: ${resolutionProgress}%`,
            resolution: resolution.suffix,
            resolutionProgress: resolutionProgress,
            currentStep: completedResolutions + 1,
            totalSteps: totalResolutions,
            visible: isAnyResolutionCompleted, // 하나라도 완료된 해상도가 있으면 노출 가능
          });

          logger.debug(
            {
              percent: progress.percent,
              resolution: resolution.suffix,
              overallProgress: overallProgress,
            },
            `${resolution.suffix} 변환 진행: ${Math.floor(progress.percent)}%`
          );
        })
        .on('end', () => {
          completedResolutions++;
          isAnyResolutionCompleted = true; // 최소 하나의 해상도 변환 완료됨

          // 전체 진행률 업데이트
          const overallProgress = Math.floor((completedResolutions / totalResolutions) * 100);
          videoQueue.setProgress(videoId, {
            status: 'processing',
            progress: overallProgress,
            message: `${resolution.suffix} 변환 완료`,
            resolution: resolution.suffix,
            currentStep: completedResolutions,
            totalSteps: totalResolutions,
            visible: true, // 하나의 해상도라도 완료되었으므로 노출 가능하도록 설정
          });

          logger.info(
            { outputPath, resolution: resolution.suffix },
            `${resolution.suffix} 변환 완료`
          );
          resolve({
            path: outputPath,
            resolution: resolution.height,
            bitrate: resolution.bitrate,
          });
        })
        .on('error', (err) => {
          logger.error(
            { err, resolution: resolution.suffix },
            `${resolution.suffix} 변환 중 오류 발생`
          );
          reject(err);
        })
        .save(outputPath);
    });
  }

  return results;
};

/**
 * 단일 해상도로 비디오를 WebM 포맷으로 변환 (VP9 코덱)
 *
 * @param {string} inputPath 입력 비디오 파일 경로
 * @param {string} outputDir 출력 디렉토리
 * @param {string} filename 출력 파일명 (확장자 제외)
 * @param {string} resolution 변환할 해상도 (예: '144p', '240p', '360p', '480p')
 * @param {string} videoId 비디오 ID (진행률 추적용)
 * @returns {Promise<Object>} 변환된 파일의 정보
 */
exports.convertToSingleResolution = async (inputPath, outputDir, filename, resolution, videoId) => {
  // 출력 디렉토리가 없으면 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 해상도별 비트레이트 설정
  const resolutionMap = {
    '144p': { height: 144, bitrate: '100k' },
    '240p': { height: 240, bitrate: '200k' },
    '360p': { height: 360, bitrate: '400k' },
    '480p': { height: 480, bitrate: '600k' },
  };

  // 요청된 해상도가 지원되지 않는 경우 오류 발생
  if (!resolutionMap[resolution]) {
    logger.error({ resolution }, `지원되지 않는 해상도: ${resolution}`);
    throw new Error(`지원되지 않는 해상도: ${resolution}`);
  }

  const resolutionConfig = resolutionMap[resolution];
  const outputPath = path.join(outputDir, `${filename}_${resolution}.webm`);

  // 큐에 저장된 진행상태 업데이트
  videoQueue.setProgress(videoId, {
    status: 'processing',
    message: `해상도 ${resolution} 변환 시작...`,
    resolution: resolution,
  });

  try {
    return await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOption('-c:v libvpx-vp9') // VP9 코덱 사용
        .outputOption('-c:a libopus') // Opus 오디오 코덱
        .outputOption('-b:v ' + resolutionConfig.bitrate) // 비디오 비트레이트
        .outputOption('-r 30') // 30fps
        .outputOption('-vf', `scale=-1:${resolutionConfig.height},setdar=4/3`) // 4:3 비율 설정
        .outputOption('-deadline good') // 인코딩 품질/속도 밸런스
        .outputOption('-cpu-used 2') // CPU 사용량 (0-5, 높을수록 빠르지만 품질 저하)
        .outputOption('-row-mt 1') // 멀티스레딩 활성화
        .outputOption('-tile-columns 2') // 타일링 사용
        .outputOption('-threads 4') // 스레드 수
        .on('start', (commandLine) => {
          logger.debug({ commandLine, resolution }, `${resolution} 변환 시작`);
        })
        .on('progress', (progress) => {
          // 해상도 진행률 계산 및 업데이트
          const resolutionProgress = Math.floor(progress.percent || 0);

          // 큐에 진행상태 업데이트
          videoQueue.setProgress(videoId, {
            status: 'processing',
            progress: resolutionProgress,
            message: `${resolution} 변환 진행: ${resolutionProgress}%`,
            resolution: resolution,
            resolutionProgress: resolutionProgress,
          });

          logger.debug(
            {
              percent: progress.percent,
              resolution,
            },
            `${resolution} 변환 진행: ${Math.floor(progress.percent)}%`
          );
        })
        .on('end', () => {
          // 변환 완료 상태 업데이트
          videoQueue.setProgress(videoId, {
            status: 'processing',
            progress: 100,
            message: `${resolution} 변환 완료`,
            resolution: resolution,
          });

          logger.info({ outputPath, resolution }, `${resolution} 변환 완료`);
          resolve({
            path: outputPath,
            resolution: resolutionConfig.height,
            bitrate: resolutionConfig.bitrate,
          });
        })
        .on('error', (err) => {
          logger.error({ err, resolution }, `${resolution} 변환 중 오류 발생`);
          reject(err);
        })
        .save(outputPath);
    });
  } catch (error) {
    logger.error({ error, resolution }, `${resolution} 변환 실패`);
    throw error;
  }
};

/**
 * 비디오에서 썸네일 생성
 *
 * @param {string} inputPath 입력 비디오 파일 경로
 * @param {string} outputDir 출력 디렉토리
 * @param {string} filename 출력 파일명 (확장자 제외)
 * @param {string} videoId 비디오 ID (진행률 추적용)
 * @returns {Promise<string>} 생성된 썸네일 파일 경로
 */
exports.generateThumbnail = async (inputPath, outputDir, filename, videoId) => {
  // 출력 디렉토리가 없으면 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${filename}_thumbnail.jpg`);

  // 진행상태 업데이트
  videoQueue.setProgress(videoId, {
    status: 'processing',
    progress: 0,
    message: '썸네일 생성 중...',
    resolution: null,
  });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .on('start', (commandLine) => {
        logger.debug({ commandLine }, '썸네일 생성 시작');
      })
      .on('end', () => {
        // 썸네일 생성 완료 업데이트
        videoQueue.setProgress(videoId, {
          status: 'processing',
          progress: 5, // 전체 과정의 5% 정도로 간주
          message: '썸네일 생성 완료',
          resolution: null,
        });

        logger.info({ outputPath }, '썸네일 생성 완료');
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error({ err }, '썸네일 생성 중 오류 발생');
        reject(err);
      })
      .screenshot({
        count: 1,
        folder: outputDir,
        filename: `${filename}_thumbnail.jpg`,
        timestamps: ['10%'],
        size: '320x240',
      });
  });
};

/**
 * 비디오 정보 가져오기
 *
 * @param {string} inputPath 비디오 파일 경로
 * @returns {Promise<Object>} 비디오 정보 (해상도, 길이 등)
 */
exports.getVideoInfo = async (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        logger.error({ err }, '비디오 정보 조회 중 오류 발생');
        return reject(err);
      }

      const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');
      const audioStream = metadata.streams.find((stream) => stream.codec_type === 'audio');

      const info = {
        duration: metadata.format.duration,
        size: metadata.format.size,
        format: metadata.format.format_name,
        width: videoStream ? videoStream.width : null,
        height: videoStream ? videoStream.height : null,
        videoCodec: videoStream ? videoStream.codec_name : null,
        audioCodec: audioStream ? audioStream.codec_name : null,
      };

      logger.debug({ info }, '비디오 정보 조회 완료');
      resolve(info);
    });
  });
};
