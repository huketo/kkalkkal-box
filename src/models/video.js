const mongoose = require('../utils/mongoose');
const logger = require('../utils/logger');

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Comment = mongoose.model('Comment', commentSchema);

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
    },
    filePath: {
      type: String,
      required: true,
    },
    thumbnailPath: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 가상 필드 설정
videoSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'videoId',
});

videoSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

const Video = mongoose.model('Video', videoSchema);

class VideoModel {
  /**
   * 최신 비디오 목록 조회
   * @param {number} limit 가져올 비디오 수
   * @returns {Promise<Array>}
   */
  async findLatest(limit = 12) {
    try {
      return await Video.find().sort({ createdAt: -1 }).populate('user', 'nickname').limit(limit);
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
      return await Video.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: query },
        ],
      })
        .sort({ createdAt: -1 })
        .populate('user', 'nickname');
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
      return await Video.findById(id)
        .populate('user', 'id nickname')
        .populate({
          path: 'comments',
          options: { sort: { createdAt: -1 } },
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
      const video = new Video(videoData);
      return await video.save();
    } catch (error) {
      logger.error({ err: error }, 'VideoModel.create 오류 발생');
      throw error;
    }
  }

  /**
   * 코멘트 생성
   * @param {object} commentData
   * @returns {Promise<object>}
   */
  async createComment(commentData) {
    try {
      const comment = new Comment(commentData);
      return await comment.save();
    } catch (error) {
      logger.error({ err: error }, 'VideoModel.createComment 오류 발생');
      throw error;
    }
  }
}

module.exports = new VideoModel();
