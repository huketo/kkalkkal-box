const mongoose = require('../utils/mongoose');
const logger = require('../utils/logger');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    nickname: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 가상 필드 설정 - 사용자가 업로드한 비디오 목록을 연결합니다
userSchema.virtual('videos', {
  ref: 'Video',
  localField: '_id',
  foreignField: 'userId',
});

const User = mongoose.model('User', userSchema);

class UserModel {
  /**
   * 사용자 이름으로 사용자 조회
   * @param {string} username
   * @returns {Promise<object|null>}
   */
  async findByUsername(username) {
    try {
      return await User.findOne({ username });
    } catch (error) {
      logger.error({ err: error }, 'UserModel.findByUsername 오류 발생');
      throw error;
    }
  }

  /**
   * 사용자 ID로 사용자 조회
   * @param {string} id
   * @param {object} options
   * @returns {Promise<object|null>}
   */
  async findById(id, options = {}) {
    try {
      if (options.includeVideos) {
        return await User.findById(id).populate({
          path: 'videos',
          options: { sort: { createdAt: -1 } },
        });
      }
      return await User.findById(id);
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
      const user = new User(userData);
      return await user.save();
    } catch (error) {
      logger.error({ err: error }, 'UserModel.create 오류 발생');
      throw error;
    }
  }
}

module.exports = new UserModel();
