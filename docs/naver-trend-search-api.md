# 네이버 통합 검색어 트렌드 API 문서

## 개요

네이버 데이터랩의 검색어 트렌드를 API로 조회하는 RESTful API입니다.
주제어로 묶은 검색어들에 대한 네이버 통합검색에서의 검색 추이 데이터를 반환합니다.

**연관 키워드 분석에 활용 가능**

### 특징
- 비로그인 방식 오픈 API
- JSON 형식 반환
- **하루 호출 한도: 1,000회**
- 조회 시작일: 2016년 1월 1일 이후

### 인증 방식
쇼핑 검색 API와 동일한 환경변수 사용

```
X-Naver-Client-Id: {NAVER_SHOPPING_CLIENT_ID}
X-Naver-Client-Secret: {NAVER_SHOPPING_CLIENT_SECRET}
Content-Type: application/json
```

---

## API 레퍼런스

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/search
```

### 프로토콜
HTTPS

### HTTP 메서드
POST

---

## 요청 파라미터 (JSON)

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `startDate` | string | Y | 조회 시작일 (yyyy-mm-dd, 2016-01-01 이후) |
| `endDate` | string | Y | 조회 종료일 (yyyy-mm-dd) |
| `timeUnit` | string | Y | 구간 단위: `date`(일간), `week`(주간), `month`(월간) |
| `keywordGroups` | array | Y | 주제어+검색어 묶음 배열 (최대 **5개**) |
| `keywordGroups.groupName` | string | Y | 주제어 (검색어 묶음 대표 이름) |
| `keywordGroups.keywords` | array(string) | Y | 검색어 배열 (최대 **20개**) |
| `device` | string | N | `pc`, `mo`, 미설정=전체 |
| `gender` | string | N | `m`(남), `f`(여), 미설정=전체 |
| `ages` | array(string) | N | 연령대 배열 (아래 참조) |

### 연령대 옵션 (ages)

| 값 | 설명 |
|----|------|
| `1` | 0~12세 |
| `2` | 13~18세 |
| `3` | 19~24세 |
| `4` | 25~29세 |
| `5` | 30~34세 |
| `6` | 35~39세 |
| `7` | 40~44세 |
| `8` | 45~49세 |
| `9` | 50~54세 |
| `10` | 55~59세 |
| `11` | 60세 이상 |

---

## 요청 예시

### cURL
```bash
curl https://openapi.naver.com/v1/datalab/search \
  -H "X-Naver-Client-Id: {CLIENT_ID}" \
  -H "X-Naver-Client-Secret: {CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "timeUnit": "week",
    "keywordGroups": [
      {
        "groupName": "볼펜",
        "keywords": ["볼펜", "젤펜", "중성펜"]
      },
      {
        "groupName": "연필",
        "keywords": ["연필", "샤프", "샤프펜슬"]
      }
    ],
    "device": "",
    "gender": "",
    "ages": []
  }'
```

---

## 응답

### 응답 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `startDate` | string | 조회 시작일 |
| `endDate` | string | 조회 종료일 |
| `timeUnit` | string | 구간 단위 |
| `results` | array | 결과 배열 |
| `results.title` | string | 주제어 |
| `results.keywords` | array | 검색어 목록 |
| `results.data` | array | 기간별 데이터 |
| `results.data.period` | string | 구간 시작일 |
| `results.data.ratio` | number | **상대적 비율** (최댓값=100 기준) |

### 응답 예시
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "timeUnit": "week",
  "results": [
    {
      "title": "볼펜",
      "keywords": ["볼펜", "젤펜", "중성펜"],
      "data": [
        { "period": "2024-01-01", "ratio": 85.32 },
        { "period": "2024-01-08", "ratio": 100.0 },
        { "period": "2024-01-15", "ratio": 92.45 },
        { "period": "2024-01-22", "ratio": 88.12 }
      ]
    },
    {
      "title": "연필",
      "keywords": ["연필", "샤프", "샤프펜슬"],
      "data": [
        { "period": "2024-01-01", "ratio": 40.08 },
        { "period": "2024-01-08", "ratio": 45.23 },
        { "period": "2024-01-15", "ratio": 42.11 },
        { "period": "2024-01-22", "ratio": 38.67 }
      ]
    }
  ]
}
```

---

## 오류 코드

| HTTP 상태 | 설명 | 해결방법 |
|----------|------|----------|
| 400 | 잘못된 요청 | URL, 파라미터 확인 |
| 403 | API 권한 없음 | 개발자센터에서 **데이터랩(검색어트렌드)** 선택 확인 |
| 500 | 서버 내부 오류 | 개발자 포럼에 신고 |

---

## TypeScript 구현 예제

```typescript
import axios from 'axios';

const CLIENT_ID = process.env.NAVER_SHOPPING_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_SHOPPING_CLIENT_SECRET;

interface KeywordGroup {
  groupName: string;
  keywords: string[];
}

interface TrendResult {
  title: string;
  keywords: string[];
  data: Array<{
    period: string;
    ratio: number;
  }>;
}

interface TrendResponse {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: TrendResult[];
}

/**
 * 통합 검색어 트렌드 조회
 * 연관 키워드 분석에 활용
 */
async function getSearchTrend(
  keywordGroups: KeywordGroup[],
  options?: {
    startDate?: string;
    endDate?: string;
    timeUnit?: 'date' | 'week' | 'month';
    device?: 'pc' | 'mo' | '';
    gender?: 'm' | 'f' | '';
    ages?: string[];
  }
): Promise<TrendResponse> {
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const response = await axios.post<TrendResponse>(
    'https://openapi.naver.com/v1/datalab/search',
    {
      startDate: options?.startDate || formatDate(oneMonthAgo),
      endDate: options?.endDate || formatDate(today),
      timeUnit: options?.timeUnit || 'week',
      keywordGroups,
      device: options?.device || '',
      gender: options?.gender || '',
      ages: options?.ages || [],
    },
    {
      headers: {
        'X-Naver-Client-Id': CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * 키워드 검색량 비교
 * 여러 키워드의 상대적 인기도 비교
 */
async function compareKeywords(keywords: string[]): Promise<TrendResult[]> {
  // 각 키워드를 개별 그룹으로 만들어 비교
  const keywordGroups = keywords.slice(0, 5).map((kw) => ({
    groupName: kw,
    keywords: [kw],
  }));

  const result = await getSearchTrend(keywordGroups);
  return result.results;
}

/**
 * 연관 키워드 트렌드 분석
 * 주제어에 대한 다양한 검색어 묶음 분석
 */
async function analyzeRelatedKeywords(
  mainKeyword: string,
  relatedKeywords: string[]
): Promise<TrendResult> {
  const result = await getSearchTrend([
    {
      groupName: mainKeyword,
      keywords: [mainKeyword, ...relatedKeywords.slice(0, 19)], // 최대 20개
    },
  ]);

  return result.results[0];
}

// 사용 예시
async function example() {
  // 1. 단일 키워드 트렌드
  const trend = await getSearchTrend([
    { groupName: '볼펜', keywords: ['볼펜', '젤펜', '중성펜'] },
  ]);
  console.log('볼펜 트렌드:', trend);

  // 2. 키워드 비교
  const comparison = await compareKeywords(['볼펜', '연필', '만년필']);
  console.log('키워드 비교:', comparison);

  // 3. 연관 키워드 분석
  const related = await analyzeRelatedKeywords('볼펜', [
    '젤펜',
    '중성펜',
    '볼펜 추천',
    '볼펜 선물',
  ]);
  console.log('연관 키워드:', related);
}

export { getSearchTrend, compareKeywords, analyzeRelatedKeywords };
```

---

## 활용 사례

### 1. 연관 키워드 발굴
```typescript
// 메인 키워드와 연관 키워드들의 검색 트렌드 비교
const result = await getSearchTrend([
  { groupName: '볼펜', keywords: ['볼펜'] },
  { groupName: '젤펜', keywords: ['젤펜'] },
  { groupName: '중성펜', keywords: ['중성펜'] },
  { groupName: '필기구', keywords: ['필기구'] },
  { groupName: '펜 추천', keywords: ['펜 추천', '펜추천'] },
]);

// ratio가 높은 키워드 = 검색량이 많은 키워드
const sortedByPopularity = result.results.sort((a, b) => {
  const avgA = a.data.reduce((sum, d) => sum + d.ratio, 0) / a.data.length;
  const avgB = b.data.reduce((sum, d) => sum + d.ratio, 0) / b.data.length;
  return avgB - avgA;
});
```

### 2. 시즌별 트렌드 분석
```typescript
// 월별 검색 추이로 시즌성 파악
const yearlyTrend = await getSearchTrend(
  [{ groupName: '볼펜', keywords: ['볼펜'] }],
  {
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    timeUnit: 'month',
  }
);

// 검색량이 높은 시즌 파악
const peakMonths = yearlyTrend.results[0].data
  .filter((d) => d.ratio > 80)
  .map((d) => d.period);
```

### 3. 타겟 고객 분석
```typescript
// 성별/연령별 검색 트렌드
const maleYoung = await getSearchTrend(
  [{ groupName: '볼펜', keywords: ['볼펜'] }],
  { gender: 'm', ages: ['3', '4'] } // 남성 19-29세
);

const femaleYoung = await getSearchTrend(
  [{ groupName: '볼펜', keywords: ['볼펜'] }],
  { gender: 'f', ages: ['3', '4'] } // 여성 19-29세
);
```

---

## 제한사항

| 항목 | 제한 |
|------|------|
| 하루 호출 한도 | **1,000회** |
| 주제어 그룹 수 | 최대 5개 |
| 그룹당 검색어 수 | 최대 20개 |
| 조회 시작일 | 2016년 1월 1일 이후 |

---

## 환경변수

쇼핑 검색 API와 동일한 환경변수 사용:

```
NAVER_SHOPPING_CLIENT_ID=MAAOtPqI3DvSX8fFX0du
NAVER_SHOPPING_CLIENT_SECRET=NRgp80qrdZ
```

---

## 쇼핑인사이트 API vs 통합 검색어 트렌드 API

| 구분 | 쇼핑인사이트 | 통합 검색어 트렌드 |
|------|-------------|------------------|
| 데이터 범위 | 네이버쇼핑 클릭 | 네이버 통합검색 |
| 용도 | 쇼핑 분야/키워드 분석 | 일반 검색어 트렌드 |
| 하루 한도 | (미명시) | 1,000회 |
| 시작일 | 2017-08-01 | 2016-01-01 |
| 연령 구분 | 10세 단위 | 5세 단위 (더 세분화) |

**추천**: 상품 키워드 분석에는 **쇼핑인사이트**, 일반 연관 키워드 발굴에는 **통합 검색어 트렌드** 활용
