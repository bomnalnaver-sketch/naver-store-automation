# Database

데이터베이스 관련 파일

## 구조

- `migrations/` - 마이그레이션 파일
- `seeds/` - 시드 데이터
- `client.ts` - DB 클라이언트
- `schema.sql` - 스키마 정의

## 주요 테이블

### 광고 관련
- `ad_keywords` - 광고 키워드 마스터
- `ad_keyword_daily_stats` - 키워드 일별 성과
- `ad_keyword_tests` - 키워드 테스트 기록
- `tested_keywords_history` - 테스트 완료 키워드

### 상품 관련
- `products` - 상품 마스터
- `product_daily_stats` - 상품 일별 성과
- `product_ab_tests` - 상품 A/B 테스트
- `product_variants` - A/B 테스트 변형

### AI 관련
- `ai_decisions` - AI 의사결정 기록
- `ai_decision_results` - 결정 결과 추적

### 설정
- `settings` - 사용자 설정
- `protected_items` - 보호 목록
