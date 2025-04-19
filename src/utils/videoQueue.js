/**
 * 비디오 처리 큐 시스템
 * 한 번에 하나의 비디오만 처리하도록 큐 관리
 */
const logger = require('./logger');

// 비디오 처리 큐
class VideoProcessingQueue {
  constructor() {
    // 큐와 현재 처리중인 작업 초기화
    this.queue = [];
    this.currentProcessing = null;
    // 각 비디오 ID별 진행 상태를 저장할 객체
    this.progressMap = new Map();
  }

  // 큐에 새 작업 추가
  addToQueue(videoId, processingFunction, params) {
    this.queue.push({ videoId, processingFunction, params });
    logger.info({ videoId, queueSize: this.queue.length }, '비디오 처리 큐에 작업 추가됨');

    // 큐가 비어있었다면 바로 작업 시작
    if (this.queue.length === 1 && !this.currentProcessing) {
      this.processNext();
    }

    // 초기 진행상태 설정
    this.setProgress(videoId, {
      status: 'queued',
      progress: 0,
      message: '처리 대기 중...',
      resolution: null,
      queuePosition: this.queue.length - 1,
    });
  }

  // 다음 작업 처리
  async processNext() {
    if (this.queue.length === 0) {
      this.currentProcessing = null;
      logger.info('모든 비디오 처리 작업 완료');
      return;
    }

    const job = this.queue[0];
    this.currentProcessing = job.videoId;

    // 작업 시작 상태로 업데이트
    this.setProgress(job.videoId, {
      status: 'processing',
      progress: 0,
      message: '변환 시작 중...',
      resolution: null,
      queuePosition: 0,
    });

    // 작업 실행
    logger.info({ videoId: job.videoId }, '비디오 처리 시작');
    try {
      await job.processingFunction(...job.params);

      // 작업 완료 상태로 업데이트
      this.setProgress(job.videoId, {
        status: 'completed',
        progress: 100,
        message: '처리 완료',
        resolution: null,
      });

      logger.info({ videoId: job.videoId }, '비디오 처리 완료');
    } catch (error) {
      // 에러 상태로 업데이트
      this.setProgress(job.videoId, {
        status: 'failed',
        progress: 0,
        message: '처리 중 오류 발생',
        error: error.message,
      });

      logger.error({ err: error, videoId: job.videoId }, '비디오 처리 중 오류 발생');
    }

    // 작업 완료 후 큐에서 제거
    this.queue.shift();

    // 다음 작업 진행
    this.processNext();
  }

  // 진행 상태 설정
  setProgress(videoId, progressInfo) {
    this.progressMap.set(videoId, {
      ...progressInfo,
      updatedAt: new Date(),
    });

    logger.debug({ videoId, progress: progressInfo }, '비디오 처리 진행 상태 업데이트');
  }

  // 진행 상태 조회
  getProgress(videoId) {
    const progress = this.progressMap.get(videoId);

    if (!progress) {
      return {
        status: 'unknown',
        progress: 0,
        message: '처리 상태 정보 없음',
      };
    }

    // 대기 중인 작업의 경우 현재 큐 위치 업데이트
    if (progress.status === 'queued') {
      const queuePosition = this.queue.findIndex((job) => job.videoId === videoId);
      progress.queuePosition = queuePosition >= 0 ? queuePosition : 0;
    }

    return progress;
  }

  // 모든 큐 작업 상태 확인
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      currentProcessing: this.currentProcessing,
      queue: this.queue.map((job) => job.videoId),
    };
  }
}

// 싱글톤 인스턴스 생성
const videoQueue = new VideoProcessingQueue();

module.exports = videoQueue;
