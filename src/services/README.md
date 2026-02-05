# Services

비즈니스 로직을 담당하는 서비스 레이어

## 구조

- `naver-api/` - 네이버 API 연동 서비스
  - `commerce-api.ts` - 커머스 API (상품, 주문, 태그)
  - `search-ad-api.ts` - 검색광고 API (키워드, 성과)
  - `api-client.ts` - 공통 API 클라이언트

- `ai/` - AI 분석 서비스
  - `claude-client.ts` - Claude API 클라이언트
  - `keyword-analyzer.ts` - 키워드 분석
  - `product-analyzer.ts` - 상품 분석

- `ad-keyword-service.ts` - 광고 키워드 관리 서비스
- `product-service.ts` - 상품 관리 서비스
- `ab-test-service.ts` - A/B 테스트 관리 서비스
- `slack-service.ts` - Slack 알림 서비스
