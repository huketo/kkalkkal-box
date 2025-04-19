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

// 변환된 비디오 포맷 정보를 위한 스키마
const videoFormatSchema = new mongoose.Schema({
  resolution: {
    type: String,
    required: true,
    enum: ['480p', '360p', '240p', '144p'],
  },
  filePath: {
    type: String,
    required: true,
  },
  bitrate: {
    type: String,
    required: true,
  },
});

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
      required: false, // false로 변경하여 초기 null 허용
    },
    originalFilePath: {
      type: String,
      required: true, // 원본 파일 경로는 필수
    },
    thumbnailPath: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    // 변환된 영상 포맷 정보를 저장
    formats: {
      type: [videoFormatSchema],
      default: [],
    },
    // 원본 비디오 파일 정보
    originalInfo: {
      width: Number,
      height: Number,
      duration: Number,
      size: Number,
      format: String,
      videoCodec: String,
      audioCodec: String,
    },
    // 변환 상태
    conversionStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
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
   * 비디오 ID로 비디오 업데이트
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object|null>}
   */
  async findByIdAndUpdate(id, updateData) {
    if (typeof id !== 'string') {
      throw new Error('Invalid video ID type');
    }

    try {
      return await Video.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error) {
      logger.error({ err: error, videoId: id }, 'VideoModel.findByIdAndUpdate 오류 발생');
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

  /**
   * 비디오 ID로 비디오 삭제
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findByIdAndDelete(id) {
    if (typeof id !== 'string') {
      throw new Error('Invalid video ID type');
    }

    try {
      // 비디오와 관련된 댓글 모두 삭제
      await Comment.deleteMany({ videoId: id });

      // 비디오 삭제
      return await Video.findByIdAndDelete(id);
    } catch (error) {
      logger.error({ err: error, videoId: id }, 'VideoModel.findByIdAndDelete 오류 발생');
      throw error;
    }
  }

  /**
   * 사용자 ID로 비디오 목록 조회
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async findByUserId(userId) {
    try {
      return await Video.find({ userId }).sort({ createdAt: -1 }).populate('user', 'nickname');
    } catch (error) {
      logger.error({ err: error, userId }, 'VideoModel.findByUserId 오류 발생');
      throw error;
    }
  }
}

module.exports = new VideoModel();
