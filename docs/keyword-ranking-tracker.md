# 키워드별 순위 추적 모듈

---

## 1. 개요

### 1.1 목적

각 키워드에서 내 상품이 몇 위에 노출되는지 자동 수집하여, 순위 변화 추이를 추적하고 성과 분석의 기반 데이터로 활용한다.

### 1.2 핵심 기능

- 키워드별 내 상품의 네이버 쇼핑 검색 순위 자동 수집
- 일일 순위 변화 추적 및 기록
- 순위 급변 시 알림 트리거
- A/B 테스트 성과 측정 데이터 제공

---

## 2. API 스펙

### 2.1 사용 API

**네이버 쇼핑 검색 API**

```
GET https://openapi.naver.com/v1/search/shop.json
```

### 2.2 요청 파라미터

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `query` | 검색 키워드 | URL 인코딩 필요 |
| `display` | 1~100 | 한 번에 가져올 결과 수 (최대 100) |
| `start` | 1~1000 | 검색 시작 위치 |
| `sort` | `sim` | 네이버 추천순 (≈ 랭킹순) |

### 2.3 응답 필드

```json
{
  "lastBuildDate": "Fri, 07 Feb 2025 10:00:00 +0900",
  "total": 125000,
  "start": 1,
  "display": 100,
  "items": [
    {
      "title": "가정용 접이식 사다리 3단",
      "link": "https://search.shopping.naver.com/gate.nhn?id=12345678",
      "productId": "12345678",
      "mallName": "내스토어",
      "brand": "",
      "maker": "",
      "category1": "생활/건강",
      "category2": "생활용품",
      "category3": "사다리",
      "category4": "",
      "lprice": "29900",
      "hprice": ""
    }
  ]
}
```

**순위 추적에 사용하는 필드:** `productId`

### 2.4 API 제약사항

| 항목 | 제한 |
|-----|------|
| `display` 최대값 | 100 |
| `start` 최대값 | 1000 |
| 일일 호출 한도 | 25,000회 |

→ 최대 1000위까지만 추적 가능 (start=901, display=100)

---

## 3. 순위 추적 로직

### 3.1 기본 알고리즘

```
[순위 추적 흐름]

입력:
  - keyword: "가정용 사다리"
  - myProductId: "12345678"
  - RANK_CHECK_LIMIT: 1000 (설정값)

처리:
  1. start=1로 시작
  2. API 호출 → 100개 상품 목록 수신
  3. 목록에서 myProductId 검색
     - 발견 → 순위 = start + index, 종료
     - 미발견 → start += 100, 다음 호출
  4. start > RANK_CHECK_LIMIT이면 "순위권 밖" 처리

출력:
  - rank: 73 (발견 시)
  - rank: null (1000위 밖)
```

### 3.2 구현 코드

```typescript
interface RankCheckConfig {
  RANK_CHECK_LIMIT: number;      // 기본값: 1000
  DISPLAY_PER_REQUEST: number;   // 고정값: 100 (API 최대)
}

interface RankResult {
  keyword: string;
  productId: string;
  rank: number | null;           // null = 순위권 밖
  checkedAt: Date;
  apiCalls: number;              // 사용한 API 호출 수
}

async function getProductRank(
  keyword: string,
  productId: string,
  config: RankCheckConfig = { RANK_CHECK_LIMIT: 1000, DISPLAY_PER_REQUEST: 100 }
): Promise<RankResult> {

  const { RANK_CHECK_LIMIT, DISPLAY_PER_REQUEST } = config;
  let apiCalls = 0;

  for (let start = 1; start <= RANK_CHECK_LIMIT; start += DISPLAY_PER_REQUEST) {

    // API 호출
    const response = await naverShopAPI.search(keyword, {
      display: DISPLAY_PER_REQUEST,
      start: start,
      sort: 'sim'
    });
    apiCalls++;

    // 내 상품 찾기
    const index = response.items.findIndex(
      item => item.productId === productId
    );

    if (index !== -1) {
      // 발견: 순위 반환
      return {
        keyword,
        productId,
        rank: start + index,
        checkedAt: new Date(),
        apiCalls
      };
    }
  }

  // 미발견: 순위권 밖
  return {
    keyword,
    productId,
    rank: null,
    checkedAt: new Date(),
    apiCalls
  };
}
```

### 3.3 다중 키워드 일괄 처리

```typescript
interface BatchRankResult {
  results: RankResult[];
  totalApiCalls: number;
  executionTime: number;  // ms
}

async function batchGetProductRanks(
  productId: string,
  keywords: string[],
  config: RankCheckConfig
): Promise<BatchRankResult> {

  const startTime = Date.now();
  const results: RankResult[] = [];
  let totalApiCalls = 0;

  for (const keyword of keywords) {
    const result = await getProductRank(keyword, productId, config);
    results.push(result);
    totalApiCalls += result.apiCalls;

    // Rate limit 대응: 호출 간 딜레이
    await sleep(100);  // 100ms
  }

  return {
    results,
    totalApiCalls,
    executionTime: Date.now() - startTime
  };
}
```

---

## 4. 설정값

### 4.1 조정 가능한 설정

```typescript
const config = {
  // 순위 추적 범위 (조정 가능)
  RANK_CHECK_LIMIT: 1000,        // 500, 1000, 2000 등

  // API 고정값
  DISPLAY_PER_REQUEST: 100,      // API 최대값, 변경 불가

  // 실행 설정
  RATE_LIMIT_DELAY: 100,         // API 호출 간 딜레이 (ms)

  // 알림 설정
  RANK_CHANGE_ALERT_THRESHOLD: 50,  // 순위 변동 알림 기준
};
```

### 4.2 설정값에 따른 API 호출 수

| RANK_CHECK_LIMIT | 호출/키워드 (최대) | 500개 키워드 시 |
|------------------|-------------------|----------------|
| 200 | 2회 | 1,000회 |
| 500 | 5회 | 2,500회 |
| 1000 | 10회 | 5,000회 |
| 2000 | 불가 (API 제한) | - |

---

## 5. 조기 종료 최적화

### 5.1 원리

순위를 발견하면 즉시 종료하여 불필요한 API 호출을 절약한다.

```
예시: 내 상품이 73위인 경우

일반 방식: 10회 호출 (1000위까지 전부)
조기 종료: 1회 호출 (1~100위에서 발견 → 종료)

절약: 9회 호출
```

### 5.2 실제 호출 수 예측

상품이 대부분 100위권 이내라면 평균 1~2회 호출로 충분.
상품이 500위권이라면 평균 5회 호출.
상품이 순위권 밖이 많으면 10회 호출 (최대).

```
예상 평균 호출 수 = Σ(순위대별 비율 × 필요 호출 수)

예:
- 30% 상품이 1~100위 → 0.3 × 1 = 0.3
- 40% 상품이 101~300위 → 0.4 × 3 = 1.2
- 20% 상품이 301~500위 → 0.2 × 5 = 1.0
- 10% 상품이 500위 밖 → 0.1 × 10 = 1.0
예상 평균: 3.5회/키워드
```

---

## 6. 데이터베이스 스키마

### 6.1 순위 기록 테이블

```sql
CREATE TABLE keyword_ranking_daily (
  id              SERIAL PRIMARY KEY,
  product_id      VARCHAR(50) NOT NULL,     -- 내 상품 ID
  keyword         VARCHAR(200) NOT NULL,    -- 검색 키워드
  rank            INTEGER,                  -- 순위 (NULL = 순위권 밖)
  rank_limit      INTEGER NOT NULL,         -- 측정 범위 (예: 1000)
  checked_at      TIMESTAMP NOT NULL,       -- 측정 시각
  api_calls       INTEGER,                  -- 사용한 API 호출 수
  created_at      TIMESTAMP DEFAULT NOW(),

  -- 인덱스
  INDEX idx_product_keyword (product_id, keyword),
  INDEX idx_checked_at (checked_at),
  INDEX idx_keyword_date (keyword, DATE(checked_at))
);
```

### 6.2 순위 변동 알림 테이블

```sql
CREATE TABLE keyword_ranking_alerts (
  id              SERIAL PRIMARY KEY,
  product_id      VARCHAR(50) NOT NULL,
  keyword         VARCHAR(200) NOT NULL,
  prev_rank       INTEGER,
  curr_rank       INTEGER,
  change_amount   INTEGER,                  -- 변동폭 (양수=상승, 음수=하락)
  alert_type      VARCHAR(20),              -- 'SURGE', 'DROP', 'ENTER', 'EXIT'
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### 6.3 알림 타입 정의

| alert_type | 조건 | 설명 |
|------------|------|------|
| `SURGE` | 순위 50+ 상승 | 급상승 |
| `DROP` | 순위 50+ 하락 | 급하락 |
| `ENTER` | NULL → 순위 진입 | 순위권 진입 |
| `EXIT` | 순위 → NULL | 순위권 이탈 |

---

## 7. 실행 흐름

### 7.1 일일 순위 수집 흐름

```
[Daily Ranking Job - 매일 06:00 KST]

1. 대상 조회
   - products 테이블에서 활성 상품 목록
   - keyword_product_mapping에서 상품별 추적 키워드 목록

2. 순위 수집
   FOR EACH product:
     FOR EACH keyword:
       - getProductRank(keyword, productId) 호출
       - keyword_ranking_daily 테이블에 저장
       - Rate limit 딜레이 적용

3. 변동 분석
   - 전일 순위와 비교
   - 변동폭 > THRESHOLD → keyword_ranking_alerts 생성

4. 알림 발송
   - 급변 알림 → Slack 발송
```

### 7.2 실행 시간 예측

```
키워드 500개, 평균 3.5회 호출, 100ms 딜레이 가정:

API 호출 수: 500 × 3.5 = 1,750회
API 호출 시간: 1,750 × 300ms = 525초 ≈ 9분
딜레이 시간: 1,750 × 100ms = 175초 ≈ 3분

총 예상 시간: 약 12분
```

---

## 8. API 호출 예산 관리

### 8.1 일일 예산 분배

일일 한도 25,000회를 기능별로 분배:

| 기능 | 예산 | 비고 |
|-----|------|------|
| 순위 추적 | 15,000회 | 메인 기능 |
| 색깔 분류 분석 | 5,000회 | 키워드 노출 위치 분석 |
| 기타/예비 | 5,000회 | 수동 조회, 재시도 등 |

### 8.2 상품/키워드 수 한계

순위 추적에 15,000회 할당 시:

| RANK_CHECK_LIMIT | 평균 호출 | 최대 키워드 수 |
|------------------|----------|---------------|
| 1000 (평균 3.5회) | 3.5회 | 4,285개 |
| 500 (평균 2.5회) | 2.5회 | 6,000개 |

→ 상품 50개 × 키워드 50개 = 2,500개도 충분히 커버

---

## 9. 에러 처리

### 9.1 API 에러 대응

```typescript
async function getProductRankWithRetry(
  keyword: string,
  productId: string,
  config: RankCheckConfig,
  maxRetries: number = 3
): Promise<RankResult> {

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getProductRank(keyword, productId, config);
    } catch (error) {
      lastError = error;

      if (error.status === 429) {
        // Rate limit: 지수 백오프
        await sleep(1000 * Math.pow(2, attempt));
      } else if (error.status >= 500) {
        // 서버 에러: 재시도
        await sleep(1000 * attempt);
      } else {
        // 기타 에러: 즉시 실패
        throw error;
      }
    }
  }

  throw lastError;
}
```

### 9.2 에러 로깅

```sql
CREATE TABLE ranking_error_logs (
  id          SERIAL PRIMARY KEY,
  keyword     VARCHAR(200),
  product_id  VARCHAR(50),
  error_code  VARCHAR(20),
  error_msg   TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 10. 활용 예시

### 10.1 순위 변화 리포트

```typescript
async function getDailyRankingReport(productId: string, date: Date) {
  const rankings = await db.query(`
    SELECT
      keyword,
      rank,
      LAG(rank) OVER (PARTITION BY keyword ORDER BY checked_at) as prev_rank,
      rank - LAG(rank) OVER (PARTITION BY keyword ORDER BY checked_at) as change
    FROM keyword_ranking_daily
    WHERE product_id = $1
      AND DATE(checked_at) = $2
    ORDER BY rank ASC NULLS LAST
  `, [productId, date]);

  return rankings;
}
```

### 10.2 Slack 알림 예시

```
🔔 순위 급변 알림

상품: 가정용 접이식 사다리 3단
키워드: "가정용 사다리"

📈 45위 → 12위 (33위 상승!)

측정 시각: 2025-02-07 06:15:23
```

### 10.3 A/B 테스트 연동

```typescript
// 상품명 변경 전후 순위 비교
async function compareRankingForABTest(
  testId: string,
  beforeDate: Date,
  afterDate: Date
) {
  const test = await getABTest(testId);

  const beforeRanks = await getRankingsForDate(test.productId, beforeDate);
  const afterRanks = await getRankingsForDate(test.productId, afterDate);

  return {
    avgRankBefore: calculateAvg(beforeRanks),
    avgRankAfter: calculateAvg(afterRanks),
    improvement: calculateAvg(beforeRanks) - calculateAvg(afterRanks),
    keywordDetails: mergeResults(beforeRanks, afterRanks)
  };
}
```

---

## 11. 체크리스트

### 11.1 개발 전 확인사항

- [ ] 네이버 쇼핑 검색 API 키 발급 완료
- [ ] API 일일 호출 한도 확인 (25,000회)
- [ ] 내 상품의 productId 확인 방법 파악
- [ ] DB 테이블 생성 완료

### 11.2 테스트 항목

- [ ] 단일 키워드 순위 조회 정상 작동
- [ ] 순위권 밖 상품 처리 (null 반환)
- [ ] 조기 종료 최적화 작동 확인
- [ ] Rate limit 에러 시 재시도 작동
- [ ] 일괄 처리 시 딜레이 적용 확인

### 11.3 운영 모니터링

- [ ] 일일 API 호출량 모니터링
- [ ] 에러율 모니터링
- [ ] 실행 시간 모니터링
- [ ] 순위 급변 알림 정상 발송 확인
