# 네이버 스마트스토어 AI 자동화 시스템

AI 기반 네이버 스마트스토어 검색광고 및 상품 최적화 자동화 시스템

## 개요

이 시스템은 AI(Claude)를 활용하여 네이버 스마트스토어의 검색광고 키워드와 상품 정보를 자동으로 A/B 테스트하고 최적화합니다.

### 주요 기능

- ✨ **광고 키워드 자동 최적화**: 성과 기반 키워드 자동 관리
- 🎯 **상품 정보 A/B 테스트**: 상품명, 태그 등 자동 테스트
- 🤖 **AI 기반 의사결정**: Claude API를 통한 지능형 분석
- 📊 **성과 추적**: 실시간 성과 모니터링 및 리포트
- 🔄 **완전 자동화**: GitHub Actions를 통한 매일 자동 실행

## 기술 스택

- **언어**: TypeScript
- **런타임**: Node.js 18+
- **데이터베이스**: PostgreSQL (Neon)
- **AI**: Claude API (Anthropic)
- **스케줄러**: GitHub Actions
- **클라이언트**: Electron
- **알림**: Slack

## 프로젝트 구조

```
naver-store-automation/
├── src/
│   ├── config/           # 설정 파일
│   ├── services/         # 비즈니스 로직
│   │   ├── naver-api/   # 네이버 API 연동
│   │   └── ai/          # AI 분석 서비스
│   ├── db/              # 데이터베이스
│   │   ├── migrations/  # 마이그레이션
│   │   └── seeds/       # 시드 데이터
│   ├── utils/           # 범용 유틸리티
│   ├── shared/          # 공통 로직
│   ├── types/           # 타입 정의
│   ├── prompts/         # AI 프롬프트
│   └── jobs/            # 스케줄 작업
├── electron/            # Electron 앱
├── tests/               # 테스트
├── docs/                # 문서
└── logs/                # 로그 파일
```

## 시작하기

### 1. 환경 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 실제 API 키 입력
```

### 2. 데이터베이스 설정

```bash
# 마이그레이션 실행
npm run db:migrate

# 시드 데이터 삽입 (선택사항)
npm run db:seed
```

### 3. 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
npm start

# 일일 자동화 작업 수동 실행
npm run daily-job
```

### 4. Electron 앱 실행

```bash
# 개발 모드
npm run electron:dev

# 빌드
npm run electron:build
```

## 테스트

```bash
# 전체 테스트
npm test

# 감시 모드
npm run test:watch

# 커버리지
npm run test:coverage
```

## 배포

### GitHub Actions 설정

1. GitHub Repository Secrets에 환경 변수 추가
2. `.github/workflows/daily-automation.yml` 확인
3. 매일 06:00 KST에 자동 실행

## 문서

- [프로젝트 기획서](docs/project-plan.md)
- [개발 가이드](CLAUDE.md)

## 라이선스

MIT
