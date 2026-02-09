# 네이버 검색광고 API 문서

## 개요

네이버 검색광고 시스템을 API로 관리하는 RESTful API입니다.
캠페인, 광고그룹, 키워드, 통계 등 광고 운영 전반을 제어할 수 있습니다.

**API 문서**: https://naver.github.io/searchad-apidoc/#/tags

---

## 인증 방식

### 필수 헤더

| 헤더 | 설명 |
|------|------|
| `X-API-KEY` | API 키 |
| `X-SECRET-KEY` | Secret 키 |
| `X-Customer-ID` | 광고주 계정 ID |
| `X-Timestamp` | 요청 시간 (밀리초) |
| `X-Signature` | HMAC-SHA256 서명 |

### 서명 생성 방법

```typescript
import crypto from 'crypto';

function generateSignature(
  timestamp: number,
  method: string,
  uri: string,
  secretKey: string
): string {
  const message = `${timestamp}.${method}.${uri}`;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

// 사용 예시
const timestamp = Date.now();
const method = 'GET';
const uri = '/ncc/keywords';
const signature = generateSignature(timestamp, method, uri, SECRET_KEY);
```

### 환경변수

```
NAVER_SEARCH_AD_API_KEY=0100000000906d43be58ad43165c68ef27f280a58bd59e04ec5f6c37c8231497be97c05d45
NAVER_SEARCH_AD_SECRET_KEY=AQAAAACQbUO+WK1DFlxo7yfygKWLS0QAe4BEORY4u1v8x7Ojcw==
NAVER_SEARCH_AD_CUSTOMER_ID=2122510
```

---

## Base URL

```
https://api.searchad.naver.com
```

---

## 주요 API 카테고리

| 카테고리 | 설명 |
|---------|------|
| Campaign | 캠페인 관리 |
| AdGroup | 광고그룹 관리 |
| Ad | 광고 소재 관리 |
| AdKeyword | 광고 키워드 관리 |
| RelKwdStat | 연관 키워드 및 통계 |
| Stats | 성과 통계 |
| Estimate | 입찰가 추정 |
| Bizmoney | 비즈머니 잔액 |

---

## 1. 캠페인 (Campaign)

### 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/campaigns` | 캠페인 목록 (타입별) |
| GET | `/ncc/campaigns?ids={ids}` | 캠페인 목록 (ID별) |
| GET | `/ncc/campaigns/{campaignId}` | 캠페인 상세 |
| POST | `/ncc/campaigns` | 캠페인 생성 |
| PUT | `/ncc/campaigns/{campaignId}?fields={fields}` | 캠페인 수정 |
| DELETE | `/ncc/campaigns/{campaignId}` | 캠페인 삭제 |
| DELETE | `/ncc/campaigns?ids={ids}` | 캠페인 다중 삭제 |

---

## 2. 광고그룹 (AdGroup)

### 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/adgroups?ids={ids}` | 광고그룹 목록 (ID별) |
| GET | `/ncc/adgroups?nccCampaignId={id}` | 광고그룹 목록 (캠페인별) |
| GET | `/ncc/adgroups/{adgroupId}` | 광고그룹 상세 |
| POST | `/ncc/adgroups` | 광고그룹 생성 |
| PUT | `/ncc/adgroups/{adgroupId}` | 광고그룹 수정 |
| PUT | `/ncc/adgroups/{adgroupId}?fields={fields}` | 광고그룹 필드 수정 |
| DELETE | `/ncc/adgroups/{adgroupId}` | 광고그룹 삭제 |

### 제외 키워드

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/adgroups/{adgroupId}/restricted-keywords?type=KEYWORD_PLUS_RESTRICT` | 제외 키워드 목록 |
| POST | `/ncc/adgroups/{adgroupId}/restricted-keywords` | 제외 키워드 생성 |
| DELETE | `/ncc/adgroups/{adgroupId}/restricted-keywords?ids={ids}` | 제외 키워드 삭제 |

---

## 3. 광고 (Ad)

### 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/ads?ids={ids}` | 광고 목록 (ID별) |
| GET | `/ncc/ads?nccAdgroupId={id}` | 광고 목록 (광고그룹별) |
| GET | `/ncc/ads/{adId}` | 광고 상세 |
| POST | `/ncc/ads` | 광고 생성 |
| PUT | `/ncc/ads/{adId}?fields={fields}` | 광고 수정 |
| DELETE | `/ncc/ads/{adId}` | 광고 삭제 |
| PUT | `/ncc/ads?ids={ids}&targetAdgroupId={id}` | 광고 복사 |

---

## 4. 광고 키워드 (AdKeyword) ⭐

키워드 관리의 핵심 API

### 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/keywords?ids={ids}` | 키워드 목록 (ID별) |
| GET | `/ncc/keywords?nccAdgroupId={id}` | 키워드 목록 (광고그룹별) |
| GET | `/ncc/keywords?nccLabelId={id}` | 키워드 목록 (레이블별) |
| GET | `/ncc/keywords/{nccKeywordId}` | 키워드 상세 |
| POST | `/ncc/keywords?nccAdgroupId={id}` | 키워드 생성 (최대 100개) |
| PUT | `/ncc/keywords/{nccKeywordId}?fields={fields}` | 키워드 수정 |
| PUT | `/ncc/keywords?fields={fields}` | 키워드 다중 수정 (최대 200개) |
| DELETE | `/ncc/keywords/{nccKeywordId}` | 키워드 삭제 |
| DELETE | `/ncc/keywords?ids={ids}` | 키워드 다중 삭제 |

### fields 파라미터 옵션

| 값 | 설명 | 필수 필드 |
|----|------|----------|
| `userLock` | On/Off 설정 | `Adkeyword.userlock` |
| `bidAmt` | 입찰가 변경 | `Adkeyword.bidAmt`, `Adkeyword.useGroupBidAmt` |
| `links` | 링크 변경 | `Adkeyword.links` (JSON) |
| `attr` | 속성 변경 | `Adkeyword.attr` (JSON) |
| `inspect` | 검수 요청 | 상태가 pending이어야 함 |

---

## 5. 연관 키워드 통계 (RelKwdStat) ⭐

**연관 키워드 발굴에 핵심 API**

### 엔드포인트

```
GET /keywordstool
```

### 파라미터

| 파라미터 | 설명 |
|---------|------|
| `hintKeywords` | 힌트 키워드 (검색어) |
| `showDetail` | 상세 통계 포함 여부 |
| `event` | 이벤트 ID |
| `month` | 조회 월 |
| `biztpId` | 업종 ID |
| `includeHintKeywords` | 힌트 키워드 포함 여부 |

### 요청 예시

```typescript
const response = await axios.get('https://api.searchad.naver.com/keywordstool', {
  headers: {
    'X-API-KEY': API_KEY,
    'X-Customer-ID': CUSTOMER_ID,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
  },
  params: {
    hintKeywords: '볼펜',
    showDetail: 1,
  },
});
```

### 응답 예시

```json
{
  "keywordList": [
    {
      "relKeyword": "볼펜",
      "monthlyPcQcCnt": 12000,
      "monthlyMobileQcCnt": 45000,
      "monthlyAvePcClkCnt": 1200,
      "monthlyAveMobileClkCnt": 3500,
      "monthlyAvePcCtr": 2.5,
      "monthlyAveMobileCtr": 3.2,
      "plAvgDepth": 15,
      "compIdx": "높음"
    }
  ]
}
```

### 응답 필드

| 필드 | 설명 |
|------|------|
| `relKeyword` | 연관 키워드 |
| `monthlyPcQcCnt` | 월간 PC 검색량 |
| `monthlyMobileQcCnt` | 월간 모바일 검색량 |
| `monthlyAvePcClkCnt` | 월평균 PC 클릭수 |
| `monthlyAveMobileClkCnt` | 월평균 모바일 클릭수 |
| `monthlyAvePcCtr` | 월평균 PC 클릭률 |
| `monthlyAveMobileCtr` | 월평균 모바일 클릭률 |
| `plAvgDepth` | 평균 노출 광고수 |
| `compIdx` | 경쟁 정도 (높음/중간/낮음) |

---

## 6. 통계 (Stats)

### 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/stats?id={id}&fields={fields}` | 단일 엔티티 통계 |
| GET | `/stats?ids={ids}&fields={fields}` | 다중 엔티티 통계 |
| GET | `/stats?id={id}&statType={type}` | 타입별 커스텀 통계 |

### 파라미터

| 파라미터 | 설명 |
|---------|------|
| `id` / `ids` | 캠페인/광고그룹/키워드 ID |
| `fields` | 조회할 필드 |
| `timeRange` | 조회 기간 |
| `datePreset` | 기간 프리셋 (today, yesterday, last_7_days 등) |
| `timeIncrement` | 시간 단위 (1=일별, 7=주별) |
| `breakdown` | 분석 기준 |

---

## 7. 입찰가 추정 (Estimate)

### 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/estimate/average-position-bid/{type}` | 평균 순위 기준 입찰가 |
| POST | `/estimate/median-bid/{type}` | 중위 입찰가 |
| POST | `/estimate/exposure-minimum-bid/{type}` | 최소 노출 입찰가 |
| POST | `/estimate/performance/{type}` | 성과 추정 |
| POST | `/estimate/performance-bulk` | 대량 성과 추정 |

### NPLA (네이버 쇼핑 파워링크)

| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/npla-estimate/average-position-bid/{type}` | 평균 순위 입찰가 |
| POST | `/npla-estimate/exposure-minimum-bid/{type}` | 최소 노출 입찰가 |

### NPC (네이버 콘텐츠)

| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/npc-estimate/average-position-bid/{type}` | 평균 순위 입찰가 |
| POST | `/npc-estimate/exposure-minimum-bid/{type}` | 최소 노출 입찰가 |
| POST | `/npc-estimate/performance` | 성과 추정 |

---

## 8. 비즈머니 (Bizmoney)

### 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/billing/bizmoney` | 잔액 및 상태 조회 |
| GET | `/billing/bizmoney/histories/charge?searchStartDt={}&searchEndDt={}` | 충전 내역 |
| GET | `/billing/bizmoney/histories/exhaust?searchStartDt={}&searchEndDt={}` | 소진 내역 |
| GET | `/billing/bizmoney/histories/period?searchStartDt={}&searchEndDt={}` | 일별 현황 |

---

## 9. 보고서 (Reports)

### 통계 보고서 (Stat Reports)

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/stat-reports` | 보고서 작업 목록 |
| GET | `/stat-reports/{reportJobId}` | 보고서 작업 상세 |
| POST | `/stat-reports` | 보고서 작업 생성 |
| DELETE | `/stat-reports/{reportJobId}` | 보고서 작업 삭제 |

### 마스터 보고서 (Master Reports)

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/master-reports` | 보고서 목록 (최대 100개) |
| GET | `/master-reports/{id}` | 보고서 상세 |
| POST | `/master-reports` | 보고서 생성 |
| DELETE | `/master-reports` | 전체 삭제 |
| DELETE | `/master-reports/{id}` | 개별 삭제 |

---

## 10. 기타 API

### 비즈니스 채널 (BusinessChannel)

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/channels` | 채널 목록 |
| GET | `/ncc/channels/{businessChannelId}` | 채널 상세 |
| POST | `/ncc/channels` | 채널 생성 |
| PUT | `/ncc/channels/{businessChannelId}?fields={fields}` | 채널 수정 |
| DELETE | `/ncc/channels/{businessChannelId}` | 채널 삭제 |

### 공유 예산 (SharedBudget)

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/shared-budgets` | 공유예산 목록 |
| GET | `/ncc/shared-budgets/{sharedBudgetId}` | 공유예산 상세 |
| POST | `/ncc/shared-budgets` | 공유예산 생성 |
| PUT | `/ncc/shared-budgets/{sharedBudgetId}` | 공유예산 수정 |
| DELETE | `/ncc/shared-budgets?ids={ids}` | 공유예산 삭제 |

### 레이블 (Label)

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/ncc/labels` | 레이블 목록 |
| PUT | `/ncc/labels` | 레이블 수정 |
| PUT | `/ncc/label-refs` | 레이블 참조 업데이트 |

### IP 제외 (IpExclusion)

| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/tool/ip-exclusions` | 제외 IP 목록 |
| POST | `/tool/ip-exclusions` | 제외 IP 등록 |
| PUT | `/tool/ip-exclusions` | 제외 IP 수정 |
| DELETE | `/tool/ip-exclusions/{id}` | 제외 IP 삭제 |

### 검수 이력 (InspectHistory)

| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/ncc/inspect-history` | 검수 이력 다중 조회 |
| GET | `/ncc/inspect-history/{id}` | 검수 이력 단일 조회 |

---

## TypeScript 클라이언트 구현

```typescript
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

class NaverSearchAdClient {
  private client: AxiosInstance;
  private apiKey: string;
  private secretKey: string;
  private customerId: string;

  constructor() {
    this.apiKey = process.env.NAVER_SEARCH_AD_API_KEY!;
    this.secretKey = process.env.NAVER_SEARCH_AD_SECRET_KEY!;
    this.customerId = process.env.NAVER_SEARCH_AD_CUSTOMER_ID!;

    this.client = axios.create({
      baseURL: 'https://api.searchad.naver.com',
    });
  }

  private generateSignature(timestamp: number, method: string, uri: string): string {
    const message = `${timestamp}.${method}.${uri}`;
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(message);
    return hmac.digest('base64');
  }

  private getHeaders(method: string, uri: string) {
    const timestamp = Date.now();
    return {
      'X-API-KEY': this.apiKey,
      'X-Customer-ID': this.customerId,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': this.generateSignature(timestamp, method, uri),
    };
  }

  // 연관 키워드 조회
  async getRelatedKeywords(hintKeyword: string) {
    const uri = '/keywordstool';
    const response = await this.client.get(uri, {
      headers: this.getHeaders('GET', uri),
      params: {
        hintKeywords: hintKeyword,
        showDetail: 1,
      },
    });
    return response.data;
  }

  // 키워드 목록 조회
  async getKeywords(adgroupId: string) {
    const uri = '/ncc/keywords';
    const response = await this.client.get(uri, {
      headers: this.getHeaders('GET', uri),
      params: { nccAdgroupId: adgroupId },
    });
    return response.data;
  }

  // 키워드 입찰가 수정
  async updateKeywordBid(keywordId: string, bidAmt: number) {
    const uri = `/ncc/keywords/${keywordId}`;
    const response = await this.client.put(
      uri,
      { nccKeywordId: keywordId, bidAmt, useGroupBidAmt: false },
      {
        headers: this.getHeaders('PUT', uri),
        params: { fields: 'bidAmt' },
      }
    );
    return response.data;
  }

  // 키워드 On/Off 토글
  async toggleKeyword(keywordId: string, enabled: boolean) {
    const uri = `/ncc/keywords/${keywordId}`;
    const response = await this.client.put(
      uri,
      { nccKeywordId: keywordId, userLock: !enabled },
      {
        headers: this.getHeaders('PUT', uri),
        params: { fields: 'userLock' },
      }
    );
    return response.data;
  }

  // 캠페인 목록 조회
  async getCampaigns() {
    const uri = '/ncc/campaigns';
    const response = await this.client.get(uri, {
      headers: this.getHeaders('GET', uri),
    });
    return response.data;
  }

  // 광고그룹 목록 조회
  async getAdgroups(campaignId: string) {
    const uri = '/ncc/adgroups';
    const response = await this.client.get(uri, {
      headers: this.getHeaders('GET', uri),
      params: { nccCampaignId: campaignId },
    });
    return response.data;
  }

  // 비즈머니 잔액 조회
  async getBizmoney() {
    const uri = '/billing/bizmoney';
    const response = await this.client.get(uri, {
      headers: this.getHeaders('GET', uri),
    });
    return response.data;
  }

  // 통계 조회
  async getStats(id: string, datePreset: string = 'last_7_days') {
    const uri = '/stats';
    const response = await this.client.get(uri, {
      headers: this.getHeaders('GET', uri),
      params: {
        id,
        datePreset,
        fields: JSON.stringify([
          'impCnt', 'clkCnt', 'ctr', 'cpc', 'avgRnk',
          'ccnt', 'pcNxAvgRnk', 'mblNxAvgRnk', 'salesAmt', 'revenueAmt'
        ]),
      },
    });
    return response.data;
  }
}

export const searchAdClient = new NaverSearchAdClient();
```

---

## Rate Limit

**초당 최대 10회 호출**

```typescript
import { naverSearchAdRateLimiter } from '@/shared/rate-limiter';

const keywords = await naverSearchAdRateLimiter.execute(
  () => searchAdClient.getKeywords(adgroupId)
);
```

---

## 주요 활용 사례

### 1. 연관 키워드 발굴

```typescript
const relatedKeywords = await searchAdClient.getRelatedKeywords('볼펜');
// 검색량, 클릭률, 경쟁도 기반으로 키워드 선별
```

### 2. 입찰가 자동 조정

```typescript
const stats = await searchAdClient.getStats(keywordId);
if (stats.roas < 100) {
  await searchAdClient.updateKeywordBid(keywordId, currentBid * 0.9);
}
```

### 3. 저성과 키워드 Off

```typescript
const keywords = await searchAdClient.getKeywords(adgroupId);
for (const keyword of keywords) {
  if (keyword.roas < 50 && keyword.daysSinceCreated > 14) {
    await searchAdClient.toggleKeyword(keyword.nccKeywordId, false);
  }
}
```

---

## 오류 코드

| HTTP 상태 | 설명 |
|----------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 실패 (서명 오류) |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 429 | Rate Limit 초과 |
| 500 | 서버 오류 |
