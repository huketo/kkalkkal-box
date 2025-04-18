# 깔깔상자 (Kkalkkal-Box)

2000년대 초반(밀레니엄 시대)의 감성을 담은 레트로 컨셉의 비디오 공유 및 시청 플랫폼입니다.

## 프로젝트 소개

깔깔상자는 복고풍 디자인과 단순한 인터페이스를 통해 사용자들이 비디오를 쉽게 공유하고 시청할 수 있는 플랫폼입니다. 2000년대 초반 인터넷 문화의 향수를 느낄 수 있는 UI/UX를 제공하며, 현대적인 기술 스택으로 구현되었습니다.

## 구현 상태 (Implementation Status)

다음은 PRD(Product Requirements Document)에 명시된 기능과 실제 구현 상태입니다:

### 필수 기능 (MVP)

- **사용자 인증**

  - [x] 회원가입 (아이디, 비밀번호, 닉네임)
  - [x] 로그인 / 로그아웃
  - [x] 사용자 프로필 페이지

- **비디오 업로드**

  - [x] 동영상 파일 업로드 (Multer 사용)
  - [x] 비디오 메타데이터(제목, 설명, 태그) 입력
  - [x] MinIO에 비디오 저장
  - [ ] 원본 영상 저화질 코덱 인코딩 (FFmpeg 미구현)
  - [ ] 영상 4:3 비율 변환 (레터박스/필러박스 추가)
  - [ ] 썸네일 자동 생성

- **비디오 시청**

  - [x] MinIO에서 비디오 스트리밍 (Presigned URL 사용)
  - [x] HTML5 기반 비디오 플레이어
  - [x] 개별 비디오 시청 페이지

- **비디오 탐색**

  - [x] 최신 업로드 비디오 목록 표시
  - [x] 제목/태그/설명 기반 검색 기능

- **상호작용**

  - [x] 좋아요 UI
  - [ ] 좋아요 기능 서버 구현
  - [x] 댓글 작성 UI
  - [ ] 댓글 기능 서버 구현

- **UI/UX**
  - [x] Nunjucks 템플릿 엔진을 사용한 서버 사이드 렌더링
  - [x] htmx를 활용한 페이지 새로고침 없는 동적 인터랙션
  - [x] 2000년대 초반 레트로 디자인 적용

## 주요 기능

- **사용자 관리**

  - 회원가입 및 로그인
  - 사용자 프로필 관리
  - JWT 기반 인증

- **비디오 서비스**

  - 비디오 업로드 및 시청
  - 썸네일 자동 생성
  - 태그 기반 분류
  - 조회수 및 좋아요 기능

- **소셜 기능**

  - 비디오에 댓글 작성
  - 사용자 간 상호작용

- **검색 기능**
  - 비디오 제목, 설명, 태그 기반 검색

## 기술 스택

### 백엔드

- **Node.js** & **Express** - 서버 프레임워크
- **MongoDB** - 데이터베이스
- **Prisma** - ORM(Object-Relational Mapping)
- **JWT** - 인증 구현
- **Nunjucks** - 템플릿 엔진

### 프론트엔드

- **HTMX** - 클라이언트 사이드 상호작용
- **CSS** - 스타일링

### 인프라

- **Docker** - 컨테이너화
- **MinIO** - 비디오 및 이미지 저장소
- **FFmpeg** - 비디오 처리

## 설치 방법

### 사전 요구사항

- Node.js (16.x 이상)
- Docker 및 Docker Compose
- Git

### 설치 단계

1. 저장소 클론

```bash
git clone https://github.com/username/kkalkkal-box.git
cd kkalkkal-box
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 필요한 환경 변수를 설정합니다. MinIO와 MongoDB의 연결 정보를 포함해야 합니다.

4. Prisma 설정

```bash
npm run prisma:generate
```

## 실행 방법

### 개발 모드로 실행

```bash
npm run dev
```

### 프로덕션 모드로 실행

```bash
npm start
```

### Docker로 실행

```bash
docker compose up -d
```

개발 환경에서는 다음 명령어를 사용할 수 있습니다:

```bash
docker compose -f docker-compose-dev.yml up -d
npx prisma db push
npx prisma generate
npm run dev
```

## 개발 가이드

### 코드 스타일

- ESLint 및 Prettier를 사용하여 코드 스타일을 유지합니다.

```bash
npm run lint      # 코드 검사
npm run lint:fix  # 코드 검사 및 자동 수정
npm run format    # 코드 포맷팅
```

### 폴더 구조

```
.
├── docs/               # 문서
├── prisma/             # Prisma 스키마 및 마이그레이션
├── public/             # 정적 파일
│   ├── css/            # 스타일시트
│   ├── images/         # 이미지
│   └── js/             # 클라이언트 사이드 자바스크립트
├── src/                # 소스 코드
│   ├── controllers/    # 컨트롤러
│   ├── middlewares/    # 미들웨어
│   ├── models/         # 모델
│   ├── routes/         # 라우트
│   └── utils/          # 유틸리티 함수
├── uploads/            # 업로드된 파일 임시 저장
└── views/              # 뷰 템플릿
    ├── auth/           # 인증 관련 뷰
    ├── layouts/        # 레이아웃 템플릿
    ├── partials/       # 부분 템플릿
    └── video/          # 비디오 관련 뷰
```

## 라이선스

이 프로젝트는 Apache-2.0 라이선스에 따라 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 제작자

- huketo - 프로젝트 메인 개발자
