const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

class UserModel {
  /**
   * 사용자 이름으로 사용자 조회
   * @param {string} username
   * @returns {Promise<object|null>}
   */
  async findByUsername(username) {
    try {
      return await prisma.user.findUnique({
        where: { username },
      });
    } catch (error) {
      logger.error({ err: error }, 'UserModel.findByUsername 오류 발생');
      throw error;
    }
  }

  /**
   * 사용자 ID로 사용자 조회
   * @param {number} id
   * @param {object} options
   * @returns {Promise<object|null>}
   */
  async findById(id, options = {}) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include: options.includeVideos
          ? {
              videos: {
                orderBy: {
                  createdAt: 'desc',
                },
              },
            }
          : undefined,
      });
    } catch (error) {
      logger.error({ err: error }, 'UserModel.findById 오류 발생');
      throw error;
    }
  }

  /**
   * 새 사용자 생성
   * @param {object} userData
   * @returns {Promise<object>}
   */
  async create(userData) {
    try {
      return await prisma.user.create({
        data: userData,
      });
    } catch (error) {
      logger.error({ err: error }, 'UserModel.create 오류 발생');
      throw error;
    }
  }
}

module.exports = new UserModel();
