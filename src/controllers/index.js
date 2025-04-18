const videoModel = require('../models/video');
const logger = require('../utils/logger');

/**
 * 메인 페이지 처리 - 최신 비디오 목록 표시
 */
exports.getHomePage = async (req, res, next) => {
  try {
    logger.info('메인 페이지 로드 시작');

    const videos = await videoModel.findLatest();

    logger.info(`메인 페이지 로드 완료 (${videos.length}개의 비디오 불러옴)`);

    res.render('index', {
      title: '깔깔상자 - 레트로 비디오 플랫폼',
      videos,
      user: req.user,
    });
  } catch (error) {
    logger.error({ err: error }, '메인 페이지 로드 중 오류 발생');
    next(error);
  }
};

/**
 * 검색 기능 처리
 */
exports.search = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      logger.info('검색어 없이 검색 시도, 메인 페이지로 리디렉션');
      return res.redirect('/');
    }

    logger.info({ searchQuery: query }, '비디오 검색 시작');

    const videos = await videoModel.search(query);

    logger.info({ searchQuery: query, resultsCount: videos.length }, '검색 완료');

    res.render('search', {
      title: `검색 결과: ${query}`,
      videos,
      query,
      user: req.user,
    });
  } catch (error) {
    logger.error({ err: error, searchQuery: req.query.query }, '검색 처리 중 오류 발생');
    next(error);
  }
};
