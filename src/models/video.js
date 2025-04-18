const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

class VideoModel {
  /**
   * 최신 비디오 목록 조회
   * @param {number} limit 가져올 비디오 수
   * @returns {Promise<Array>}
   */
  async findLatest(limit = 12) {
    try {
      return await prisma.video.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              nickname: true,
            },
          },
        },
        take: limit,
      });
    } catch (error) {
      logger.error({ err: error }, 'VideoModel.findLatest 오류 발생');
      throw error;
    }
  }

  /**
   * 검색어로 비디오 검색
   * @param {string} query 검색어
   * @returns {Promise<Array>}
   */
  async search(query) {
    try {
      return await prisma.video.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              nickname: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error({ err: error, query }, 'VideoModel.search 오류 발생');
      throw error;
    }
  }

  /**
   * 비디오 ID로 비디오 조회
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (typeof id !== 'string') {
      throw new Error('Invalid video ID type');
    }

    try {
      return await prisma.video.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
            },
          },
          comments: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
    } catch (error) {
      logger.error({ err: error, videoId: id }, 'VideoModel.findById 오류 발생');
      throw error;
    }
  }

  /**
   * 새 비디오 생성
   * @param {object} videoData
   * @returns {Promise<object>}
   */
  async create(videoData) {
    try {
      return await prisma.video.create({
        data: videoData,
      });
    } catch (error) {
      logger.error({ err: error }, 'VideoModel.create 오류 발생');
      throw error;
    }
  }
}

module.exports = new VideoModel();
