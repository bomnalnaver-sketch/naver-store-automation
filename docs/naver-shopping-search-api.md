# 네이버 쇼핑인사이트 API 문서

## 개요

네이버 통합검색의 쇼핑 영역과 네이버쇼핑에서의 검색 클릭 추이를 조회하는 API입니다.

### 인증 방식
- 비로그인 방식 오픈 API
- HTTP 헤더에 클라이언트 아이디/시크릿 전송

```
X-Naver-Client-Id: {클라이언트 아이디}
X-Naver-Client-Secret: {클라이언트 시크릿}
Content-Type: application/json
```

---

## API 목록

| API | URL | 설명 |
|-----|-----|------|
| 분야별 트렌드 | `/v1/datalab/shopping/categories` | 쇼핑 분야별 검색 클릭 추이 |
| 분야 내 기기별 | `/v1/datalab/shopping/category/device` | 특정 분야의 PC/모바일별 추이 |
| 분야 내 성별 | `/v1/datalab/shopping/category/gender` | 특정 분야의 성별 추이 |
| 분야 내 연령별 | `/v1/datalab/shopping/category/age` | 특정 분야의 연령별 추이 |
| 키워드별 트렌드 | `/v1/datalab/shopping/category/keywords` | 키워드별 검색 클릭 추이 |
| 키워드 기기별 | `/v1/datalab/shopping/category/keyword/device` | 키워드의 PC/모바일별 추이 |
| 키워드 성별 | `/v1/datalab/shopping/category/keyword/gender` | 키워드의 성별 추이 |
| 키워드 연령별 | `/v1/datalab/shopping/category/keyword/age` | 키워드의 연령별 추이 |

**Base URL**: `https://openapi.naver.com`
**프로토콜**: HTTPS
**HTTP 메서드**: POST

---

## 1. 분야별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/categories
```

### 파라미터 (JSON)

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `startDate` | string | Y | 조회 시작일 (yyyy-mm-dd, 2017-08-01 이후) |
| `endDate` | string | Y | 조회 종료일 (yyyy-mm-dd) |
| `timeUnit` | string | Y | 구간 단위: `date`(일간), `week`(주간), `month`(월간) |
| `category` | array | Y | 분야 배열 (최대 3개) |
| `category.name` | string | Y | 쇼핑 분야 이름 |
| `category.param` | array(string) | Y | 쇼핑 분야 코드 (cat_id) |
| `device` | string | N | `pc`, `mo`, 미설정=전체 |
| `gender` | string | N | `m`(남), `f`(여), 미설정=전체 |
| `ages` | array | N | `10`,`20`,`30`,`40`,`50`,`60` |

### 요청 예시
```bash
curl https://openapi.naver.com/v1/datalab/shopping/categories \
  -H "X-Naver-Client-Id: {CLIENT_ID}" \
  -H "X-Naver-Client-Secret: {CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2017-08-01",
    "endDate": "2017-09-30",
    "timeUnit": "month",
    "category": [
      {"name": "패션의류", "param": ["50000000"]},
      {"name": "화장품/미용", "param": ["50000002"]}
    ],
    "device": "pc",
    "gender": "f",
    "ages": ["20", "30"]
  }'
```

### 응답
```json
{
  "startDate": "2017-08-01",
  "endDate": "2017-09-30",
  "timeUnit": "month",
  "results": [
    {
      "title": "패션의류",
      "category": ["50000000"],
      "data": [
        { "period": "2017-08-01", "ratio": 84.01252 },
        { "period": "2017-09-01", "ratio": 100 }
      ]
    },
    {
      "title": "화장품/미용",
      "category": ["50000002"],
      "data": [
        { "period": "2017-08-01", "ratio": 22.21162 },
        { "period": "2017-09-01", "ratio": 21.54278 }
      ]
    }
  ]
}
```

---

## 2. 분야 내 기기별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/category/device
```

### 파라미터 (JSON)

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `startDate` | string | Y | 조회 시작일 |
| `endDate` | string | Y | 조회 종료일 |
| `timeUnit` | string | Y | `date`, `week`, `month` |
| `category` | string | Y | 분야 코드 (단일) |
| `device` | string | N | `pc`, `mo`, 미설정=전체 |
| `gender` | string | N | `m`, `f`, 미설정=전체 |
| `ages` | array | N | 연령대 배열 |

### 응답 예시
```json
{
  "startDate": "2017-08-01",
  "endDate": "2017-09-30",
  "timeUnit": "month",
  "results": [
    {
      "title": "50000000",
      "category": ["50000000"],
      "data": [
        { "period": "2017-08-01", "group": "mo", "ratio": 81.12853 },
        { "period": "2017-08-01", "group": "pc", "ratio": 6.02597 },
        { "period": "2017-09-01", "group": "mo", "ratio": 100 },
        { "period": "2017-09-01", "group": "pc", "ratio": 7.1727 }
      ]
    }
  ]
}
```

---

## 3. 분야 내 성별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/category/gender
```

### 응답 예시
```json
{
  "results": [
    {
      "title": "50000000",
      "data": [
        { "period": "2017-08-01", "group": "f", "ratio": 84.01252 },
        { "period": "2017-08-01", "group": "m", "ratio": 56.61947 },
        { "period": "2017-09-01", "group": "f", "ratio": 100 },
        { "period": "2017-09-01", "group": "m", "ratio": 67.78792 }
      ]
    }
  ]
}
```

---

## 4. 분야 내 연령별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/category/age
```

### 응답 예시
```json
{
  "results": [
    {
      "data": [
        { "period": "2017-08-01", "group": "20", "ratio": 71.30781 },
        { "period": "2017-08-01", "group": "30", "ratio": 81.43603 },
        { "period": "2017-09-01", "group": "20", "ratio": 81.8108 },
        { "period": "2017-09-01", "group": "30", "ratio": 100 }
      ]
    }
  ]
}
```

---

## 5. 키워드별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/category/keywords
```

### 파라미터 (JSON)

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `startDate` | string | Y | 조회 시작일 |
| `endDate` | string | Y | 조회 종료일 |
| `timeUnit` | string | Y | `date`, `week`, `month` |
| `category` | string | Y | 분야 코드 |
| `keyword` | array | Y | 키워드 배열 (최대 5개) |
| `keyword.name` | string | Y | 키워드 그룹 이름 |
| `keyword.param` | array(string) | Y | 검색어 (1개만) |
| `device` | string | N | `pc`, `mo` |
| `gender` | string | N | `m`, `f` |
| `ages` | array | N | 연령대 |

### 요청 예시
```bash
curl https://openapi.naver.com/v1/datalab/shopping/category/keywords \
  -H "X-Naver-Client-Id: {CLIENT_ID}" \
  -H "X-Naver-Client-Secret: {CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2017-08-01",
    "endDate": "2017-09-30",
    "timeUnit": "month",
    "category": "50000000",
    "keyword": [
      {"name": "패션의류/정장", "param": ["정장"]},
      {"name": "패션의류/비지니스 캐주얼", "param": ["비지니스 캐주얼"]}
    ]
  }'
```

### 응답 예시
```json
{
  "results": [
    {
      "title": "패션의류/정장",
      "keyword": ["정장"],
      "data": [
        { "period": "2017-08-01", "ratio": 60.49919 },
        { "period": "2017-09-01", "ratio": 100 }
      ]
    },
    {
      "title": "패션의류/비즈니스 캐주얼",
      "keyword": ["비지니스 캐주얼"],
      "data": [
        { "period": "2017-08-01", "ratio": 0.41981 },
        { "period": "2017-09-01", "ratio": 2.18303 }
      ]
    }
  ]
}
```

---

## 6. 키워드 기기별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/category/keyword/device
```

### 파라미터
- `category`: 분야 코드 (string)
- `keyword`: 검색 키워드 (string, 단일)

### 응답 예시
```json
{
  "results": [
    {
      "title": "정장",
      "keyword": ["정장"],
      "data": [
        { "period": "2017-08-01", "group": "mo", "ratio": 58.06418 },
        { "period": "2017-08-01", "group": "pc", "ratio": 23.72304 },
        { "period": "2017-09-01", "group": "mo", "ratio": 100 },
        { "period": "2017-09-01", "group": "pc", "ratio": 35.18728 }
      ]
    }
  ]
}
```

---

## 7. 키워드 성별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/category/keyword/gender
```

### 응답 예시
```json
{
  "results": [
    {
      "title": "정장",
      "keyword": ["정장"],
      "data": [
        { "period": "2017-08-01", "group": "f", "ratio": 12.06534 },
        { "period": "2017-08-01", "group": "m", "ratio": 59.00816 },
        { "period": "2017-09-01", "group": "f", "ratio": 20.8518 },
        { "period": "2017-09-01", "group": "m", "ratio": 100 }
      ]
    }
  ]
}
```

---

## 8. 키워드 연령별 트렌드 조회

### 요청 URL
```
POST https://openapi.naver.com/v1/datalab/shopping/category/keyword/age
```

### 응답 예시
```json
{
  "results": [
    {
      "title": "정장",
      "keyword": ["정장"],
      "data": [
        { "period": "2017-08-01", "group": "10", "ratio": 9.7021 },
        { "period": "2017-08-01", "group": "20", "ratio": 57.88466 },
        { "period": "2017-09-01", "group": "10", "ratio": 13.55561 },
        { "period": "2017-09-01", "group": "20", "ratio": 100 }
      ]
    }
  ]
}
```

---

## 공통 응답 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `startDate` | string | 조회 시작일 |
| `endDate` | string | 조회 종료일 |
| `timeUnit` | string | 구간 단위 |
| `results.title` | string | 분야/키워드 이름 |
| `results.category` | array | 분야 코드 |
| `results.keyword` | array | 검색 키워드 |
| `results.data.period` | string | 구간 시작일 |
| `results.data.group` | string | 그룹 (기기/성별/연령) |
| `results.data.ratio` | number | **상대적 비율** (최댓값=100 기준) |

---

## 공통 파라미터 옵션

### timeUnit (구간 단위)
| 값 | 설명 |
|----|------|
| `date` | 일간 |
| `week` | 주간 |
| `month` | 월간 |

### device (기기)
| 값 | 설명 |
|----|------|
| (미설정) | 모든 기기 |
| `pc` | PC |
| `mo` | 모바일 |

### gender (성별)
| 값 | 설명 |
|----|------|
| (미설정) | 모든 성별 |
| `m` | 남성 |
| `f` | 여성 |

### ages (연령)
| 값 | 설명 |
|----|------|
| `10` | 10~19세 |
| `20` | 20~29세 |
| `30` | 30~39세 |
| `40` | 40~49세 |
| `50` | 50~59세 |
| `60` | 60세 이상 |

---

## 오류 코드

| HTTP 상태 | 설명 | 해결방법 |
|----------|------|----------|
| 400 | 잘못된 요청 | URL, 파라미터 확인 |
| 403 | API 권한 없음 | 개발자센터에서 **데이터랩(쇼핑인사이트)** 선택 확인 |
| 500 | 서버 내부 오류 | 개발자 포럼에 신고 |

---

## TypeScript 구현 예제

```typescript
import axios from 'axios';

const CLIENT_ID = process.env.NAVER_SHOPPING_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_SHOPPING_CLIENT_SECRET;

// 분야별 트렌드 조회
async function getCategoryTrend() {
  const response = await axios.post(
    'https://openapi.naver.com/v1/datalab/shopping/categories',
    {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      timeUnit: 'month',
      category: [
        { name: '패션의류', param: ['50000000'] },
        { name: '화장품/미용', param: ['50000002'] }
      ],
      device: '',
      gender: '',
      ages: []
    },
    {
      headers: {
        'X-Naver-Client-Id': CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

// 키워드별 트렌드 조회
async function getKeywordTrend(category: string, keywords: string[]) {
  const response = await axios.post(
    'https://openapi.naver.com/v1/datalab/shopping/category/keywords',
    {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      timeUnit: 'week',
      category,
      keyword: keywords.map((kw, i) => ({
        name: `키워드${i + 1}`,
        param: [kw]
      }))
    },
    {
      headers: {
        'X-Naver-Client-Id': CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

---

## 카테고리 코드 확인 방법

네이버쇼핑에서 카테고리 선택 시 URL의 `cat_id` 파라미터 값 확인

예시:
- 패션의류: `50000000`
- 화장품/미용: `50000002`
- 생활/건강: `50000008`
- 문구/사무용품: `50000158`

---

## 환경변수

```
NAVER_SHOPPING_CLIENT_ID=MAAOtPqI3DvSX8fFX0du
NAVER_SHOPPING_CLIENT_SECRET=NRgp80qrdZ
```

---

## 주의사항

1. **조회 시작일**: 2017년 8월 1일 이후부터 가능
2. **ratio 값**: 절대값이 아닌 상대적 비율 (최댓값=100)
3. **403 오류**: 개발자센터에서 **데이터랩(쇼핑인사이트)** API 선택 필요
4. 분야별 트렌드는 최대 **3개** 분야 비교 가능
5. 키워드별 트렌드는 최대 **5개** 키워드 비교 가능
