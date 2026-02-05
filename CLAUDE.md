# Claude Code 개발 가이드

이 문서는 Claude Code가 이 프로젝트에서 코드를 작성할 때 따라야 할 규칙을 정의합니다.

---

## 프로젝트 개요

네이버 스마트스토어 AI 자동화 시스템
- 검색광고 키워드 A/B 테스트 자동화
- 상품 정보 A/B 테스트 자동화
- AI 기반 성과 분석 및 최적화

**기술 스택**: Node.js, TypeScript, PostgreSQL (Neon), Claude API, Electron, GitHub Actions

---

## 1. 파일 크기 규칙

### 1.1 기본 원칙
- 파일당 **300줄 권장**, 최대 **500줄**
- 500줄 초과 시 **반드시 분리**
- 함수는 **50줄 이하** 권장

### 1.2 분리 기준
```
✅ 좋은 예:
src/
  services/
    naver-api/
      commerce-api.ts       (200줄)
      search-ad-api.ts      (180줄)
      api-client.ts         (150줄)

❌ 나쁜 예:
src/
  services/
    naver-api.ts           (800줄) ← 반드시 분리
```

---

## 2. 중복 코드 방지

### 2.1 필수 원칙
- **2번 이상 사용되는 로직**은 무조건 `utils/` 또는 `shared/`로 분리
- 새 함수 작성 전 **기존 utils 먼저 확인**
- 비슷한 함수 있으면 **기존 함수 확장**
- 같은 기능 함수 2개 이상 발견 시 **즉시 통합**

### 2.2 공통 로직 위치
```
src/
  utils/           # 범용 유틸리티
    date.ts        # 날짜 처리
    format.ts      # 포맷 변환
    validation.ts  # 유효성 검증

  shared/          # 프로젝트 특화 공통 로직
    api-utils.ts   # API 공통 처리
    db-utils.ts    # DB 공통 처리
    ai-utils.ts    # AI 공통 처리
```

### 2.3 예시
```typescript
// ❌ 나쁜 예: 중복 코드
// file1.ts
const formatDate = (date: Date) => date.toISOString().split('T')[0];

// file2.ts
const formatDate = (date: Date) => date.toISOString().split('T')[0];

// ✅ 좋은 예: utils로 분리
// utils/date.ts
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// file1.ts, file2.ts
import { formatDate } from '@/utils/date';
```

---

## 3. 주석 규칙

### 3.1 파일 상단 주석 (필수)
```typescript
/**
 * @file commerce-api.ts
 * @description 네이버 커머스 API 연동 서비스
 * @responsibilities
 * - 상품 조회/수정
 * - 주문 데이터 조회
 * - 태그 검색 및 등록
 */
```

### 3.2 함수 주석
```typescript
/**
 * 상품별 일일 성과 데이터 조회
 * @param productId 상품 ID
 * @param startDate 조회 시작일 (YYYY-MM-DD)
 * @param endDate 조회 종료일 (YYYY-MM-DD)
 * @returns 일별 성과 데이터 배열
 */
async function getProductDailyStats(
  productId: string,
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  // ...
}
```

### 3.3 복잡한 로직 주석
```typescript
// ROAS 계산: (매출 / 광고비) * 100
// 100% 미만이면 적자, 100% 이상이면 흑자
const roas = (sales / adCost) * 100;

// 14일 테스트 보호: 신규 키워드는 14일간 탈락 면제
// 이유: 초기 데이터가 불안정하므로 충분한 측정 기간 필요
if (daysSinceCreated < 14) {
  return { protected: true, reason: 'test_period' };
}
```

---

## 4. 코드 스타일

### 4.1 네이밍 컨벤션
```typescript
// 변수/함수: camelCase
const adKeywords = [];
function getKeywordStats() {}

// 클래스/타입/인터페이스: PascalCase
class ApiClient {}
type AdKeyword = {};
interface ProductData {}

// 상수: UPPER_SNAKE_CASE
const MAX_KEYWORDS_PER_PRODUCT = 5;
const TEST_PROTECTION_DAYS = 14;
const MIN_ROAS_THRESHOLD = 100;

// 파일명: kebab-case
commerce-api.ts
ad-keyword-service.ts
ai-decision-engine.ts
```

### 4.2 하드코딩 금지
```typescript
// ❌ 나쁜 예: 하드코딩
if (roas < 100) { ... }
if (testDays < 14) { ... }

// ✅ 좋은 예: 상수 사용
const MIN_ROAS_THRESHOLD = 100;
const TEST_PROTECTION_DAYS = 14;

if (roas < MIN_ROAS_THRESHOLD) { ... }
if (testDays < TEST_PROTECTION_DAYS) { ... }
```

### 4.3 설정값 관리
모든 설정값은 다음 위치에서 관리:
- 환경 변수: `.env`
- 앱 설정: `config/app-config.ts`
- DB 설정: `settings` 테이블

```typescript
// config/app-config.ts
export const APP_CONFIG = {
  MAX_KEYWORDS_PER_PRODUCT: 5,
  TEST_PROTECTION_DAYS: 14,
  MIN_ROAS_THRESHOLD: 100,
  AB_TEST_DURATION_DAYS: 14,
} as const;
```

---

## 5. 코드 생성 규칙

### 5.1 새 파일 생성 시
1. **폴더 위치 명시**
2. **파일 역할 주석 필수**
3. **500줄 초과 예상되면 미리 분리 제안**

```typescript
// src/services/naver-api/commerce-api.ts
/**
 * @file commerce-api.ts
 * @description 네이버 커머스 API 연동
 */

// src/services/naver-api/search-ad-api.ts
/**
 * @file search-ad-api.ts
 * @description 네이버 검색광고 API 연동
 */
```

### 5.2 기존 파일 수정 시
1. **어느 부분인지 명시**
2. **변경 전/후 명확히 구분**

```typescript
// 수정 위치: src/services/ad-keyword-service.ts:45-60
// 변경 전:
async function evaluateKeyword(keyword: AdKeyword) {
  // ...
}

// 변경 후:
async function evaluateKeyword(keyword: AdKeyword): Promise<EvaluationResult> {
  // ROAS 우선 평가
  if (keyword.roas < MIN_ROAS_THRESHOLD) {
    return { shouldRemove: true, reason: 'low_roas' };
  }
  // ...
}
```

---

## 6. 리팩토링 규칙

### 6.1 진행 방식
- **파일 하나씩 진행**
- 변경 전/후 명확히 구분
- 테스트 후 다음 파일로

### 6.2 리팩토링 체크리스트
- [ ] 중복 코드 제거
- [ ] 함수 크기 50줄 이하
- [ ] 파일 크기 500줄 이하
- [ ] 하드코딩 제거
- [ ] 주석 추가/업데이트
- [ ] 타입 안전성 확인

---

## 7. 데이터베이스 규칙

### 7.1 설계 원칙
- 처음부터 **확장 가능한 구조**로 설계
- 테이블 간 **의존성 최소화**
- 무거운 쿼리 **미리 최적화**

### 7.2 쿼리 최적화
```typescript
// ❌ 나쁜 예: N+1 쿼리
const keywords = await db.adKeywords.findMany();
for (const keyword of keywords) {
  const stats = await db.stats.findMany({ where: { keywordId: keyword.id } });
}

// ✅ 좋은 예: JOIN 사용
const keywordsWithStats = await db.adKeywords.findMany({
  include: { stats: true }
});
```

### 7.3 인덱스
```sql
-- 자주 조회되는 컬럼에 인덱스 추가
CREATE INDEX idx_ad_keywords_product_id ON ad_keywords(product_id);
CREATE INDEX idx_ad_keywords_status ON ad_keywords(status);
CREATE INDEX idx_daily_stats_date ON ad_keyword_daily_stats(date);
```

---

## 8. API 규칙

### 8.1 Rate Limit (매우 중요!)

**⚠️ 네이버 커머스 API: 초당 최대 2회 호출**
- 초과 시 API 호출 일시적 중단
- 반드시 `naverCommerceRateLimiter` 사용
- 안전 마진 적용: 실제로는 초당 1.8회로 제한

```typescript
// ❌ 나쁜 예: Rate Limiter 없이 직접 호출
const products = await naverCommerceApi.getProducts();

// ✅ 좋은 예: Rate Limiter 사용
import { naverCommerceRateLimiter } from '@/shared/rate-limiter';

const products = await naverCommerceRateLimiter.execute(
  () => naverCommerceApi.getProducts()
);
```

**네이버 검색광고 API: 초당 최대 10회**
```typescript
import { naverSearchAdRateLimiter } from '@/shared/rate-limiter';

const keywords = await naverSearchAdRateLimiter.execute(
  () => naverSearchAdApi.getKeywords()
);
```

### 8.2 외부 API 호출
- **타임아웃 설정** 필수
- **재시도 로직** 구현
- **실패 시 fallback** 처리

```typescript
// src/shared/api-utils.ts
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  timeout = 30000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await withTimeout(fn(), timeout);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // 지수 백오프
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 8.3 에러 처리
```typescript
try {
  // Rate Limiter와 함께 사용
  const result = await naverCommerceRateLimiter.execute(
    () => naverApi.getProducts()
  );
  return result;
} catch (error) {
  // 에러 로깅
  logger.error('Failed to fetch products', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // 사용자 알림
  await slack.sendError('상품 조회 실패', error);

  // fallback
  return cachedProducts || [];
}
```

---

## 9. AI (Claude API) 규칙

### 9.1 프롬프트 관리
- 모든 AI 프롬프트는 `prompts/` 폴더에서 관리
- 프롬프트 버전 관리 (성과 비교용)

```
src/
  prompts/
    ad-keyword-analysis.ts   # 광고 키워드 분석
    product-optimization.ts  # 상품 최적화
    keyword-discovery.ts     # 키워드 발굴
```

### 9.2 AI 응답 검증
```typescript
// AI 응답은 항상 검증
const aiResponse = await claude.analyze(data);

// 스키마 검증
const validated = validateSchema(aiResponse, ActionListSchema);
if (!validated.success) {
  logger.error('Invalid AI response', validated.errors);
  throw new Error('AI response validation failed');
}
```

---

## 10. 테스트

### 10.1 필수 테스트
- **API 통합 테스트** 필수
- **주요 로직 단위 테스트** 필수
- **배포 전 테스트 통과** 확인

### 10.2 테스트 작성
```typescript
// tests/services/ad-keyword-service.test.ts
describe('AdKeywordService', () => {
  describe('evaluateKeyword', () => {
    it('should remove keyword with ROAS below threshold', async () => {
      const keyword = { roas: 80, daysSinceCreated: 20 };
      const result = await service.evaluateKeyword(keyword);
      expect(result.shouldRemove).toBe(true);
      expect(result.reason).toBe('low_roas');
    });

    it('should protect keyword in test period', async () => {
      const keyword = { roas: 80, daysSinceCreated: 10 };
      const result = await service.evaluateKeyword(keyword);
      expect(result.shouldRemove).toBe(false);
      expect(result.protected).toBe(true);
    });
  });
});
```

---

## 11. 로깅 및 모니터링

### 11.1 에러 로깅 필수
```typescript
// 모든 에러는 로깅
logger.error('Error message', {
  context: 'function_name',
  error: error.message,
  stack: error.stack,
  data: relevantData
});
```

### 11.2 주요 지표 로깅
```typescript
// API 응답 시간
logger.info('API call completed', {
  endpoint: '/api/keywords',
  duration: 1250, // ms
  status: 200
});

// AI 분석 결과
logger.info('AI analysis completed', {
  type: 'keyword_evaluation',
  decisions: 5,
  duration: 2300 // ms
});
```

---

## 12. 보안

### 12.1 환경 변수 관리
- **절대 하드코딩 금지**
- `.env` 파일 사용
- `.env.example` 제공

```bash
# .env
NAVER_COMMERCE_CLIENT_ID=your_client_id
NAVER_COMMERCE_CLIENT_SECRET=your_client_secret
NAVER_SEARCH_AD_API_KEY=your_api_key
CLAUDE_API_KEY=your_claude_key
SLACK_WEBHOOK_URL=your_webhook_url
DATABASE_URL=your_database_url
```

### 12.2 민감 정보 로깅 금지
```typescript
// ❌ 나쁜 예
logger.info('API call', { apiKey: process.env.API_KEY });

// ✅ 좋은 예
logger.info('API call', { endpoint: '/api/keywords' });
```

---

## 13. GitHub Actions

### 13.1 스케줄 실행
- 매일 **06:00 KST** 실행
- 실패 시 **Slack 알림**
- 재시도 로직 포함

### 13.2 환경 변수
- GitHub Secrets에 모든 민감 정보 저장
- Actions에서 secrets 사용

---

## 14. 코드 리뷰 체크리스트

새 코드 작성 시 다음을 확인:
- [ ] 파일 크기 500줄 이하
- [ ] 중복 코드 없음
- [ ] 파일 상단 주석 있음
- [ ] 하드코딩 없음
- [ ] 타입 안전성 확보 (TypeScript)
- [ ] 에러 처리 구현
- [ ] 주요 로직 테스트 작성
- [ ] 환경 변수 사용 (민감 정보)
- [ ] 로깅 추가

---

## 15. 긴급 상황 대응

### 15.1 롤백
- 배포 전 **이전 버전 태그** 생성
- 문제 발생 시 **즉시 롤백**

### 15.2 장애 알림
- 주요 에러는 **Slack 즉시 알림**
- 장애 발생 시 **자동 실행 중지** 옵션

```typescript
// 심각한 에러 발생 시
if (criticalError) {
  await slack.sendCriticalAlert('시스템 장애 발생', error);
  await db.settings.update({ autoRunEnabled: false });
  process.exit(1);
}
```

---

## 요약

1. **파일 작게**: 500줄 넘으면 분리
2. **중복 제거**: 2번 이상 사용되면 utils로
3. **주석 필수**: 파일 역할, 복잡한 로직
4. **하드코딩 금지**: 모든 설정은 config/env
5. **타입 안전**: TypeScript 적극 활용
6. **에러 처리**: 모든 외부 호출에 try-catch
7. **테스트 작성**: 주요 로직 단위 테스트
8. **로깅**: 에러, 주요 지표 모두 로깅
