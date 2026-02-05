/**
 * @file product-optimization.ts
 * @description 상품 최적화 AI 프롬프트
 * @responsibilities
 * - 상품명 최적화 프롬프트
 * - 태그 최적화 프롬프트
 * - A/B 테스트 설계 프롬프트
 */

import type { Product } from '@/types/db.types';

/**
 * 상품명 최적화 프롬프트
 */
export function createProductNameOptimizationPrompt(data: {
  product: Product;
  stats: {
    views: number;
    clicks: number;
    conversions: number;
    clickRate: number;
    conversionRate: number;
  };
}): string {
  const { product, stats } = data;

  return `
당신은 네이버 스마트스토어 상품명 최적화 전문가입니다.
검색 노출과 클릭률을 높이기 위한 상품명 개선안을 제시하세요.

## 현재 상품 정보
- 상품명: ${product.name}
- 카테고리: ${product.categoryName || '미지정'}
- 태그: ${product.tags?.join(', ') || '없음'}
- 가격: ${product.price?.toLocaleString()}원

## 성과 데이터 (최근 14일)
- 조회수: ${stats.views.toLocaleString()}
- 클릭수: ${stats.clicks.toLocaleString()}
- 전환수: ${stats.conversions.toLocaleString()}
- 클릭률(CTR): ${stats.clickRate.toFixed(2)}%
- 전환율: ${stats.conversionRate.toFixed(2)}%

## 최적화 가이드라인

### 1. 네이버 스마트스토어 상품명 원칙
- 최대 100자 이내 (공백 포함)
- 핵심 키워드는 앞쪽에 배치
- 브랜드명 + 제품명 + 핵심 특징
- 특수문자는 최소화 ([]는 사용 가능)

### 2. 검색 최적화 (SEO)
- 고객이 검색할 만한 키워드 포함
- 제품의 핵심 특징과 장점 강조
- 시즌, 트렌드, 인기 키워드 반영
- 예: "겨울", "신상", "베스트", "추천" 등

### 3. 클릭률 향상
- 숫자로 구체성 부여 (예: "3개입", "10% 할인")
- 혜택 강조 (예: "무료배송", "사은품")
- 긴급성 표현 (예: "한정수량", "오늘만")

### 4. 피해야 할 요소
- 과장 광고 (예: "최고", "1등", "유일한")
- 중복 키워드 나열
- 의미 없는 특수문자 남발

## 분석 요청
1. **현재 상품명의 문제점**
   - SEO 관점에서 개선 필요한 부분
   - 클릭률이 낮은 원인 분석

2. **개선 제안**
   - 검색 키워드 최적화 방안
   - 클릭률 향상을 위한 문구 개선
   - 3가지 대안 제시

## 응답 형식 (반드시 JSON으로만 응답하세요)
\`\`\`json
{
  "analysis": {
    "currentIssues": ["문제점 1", "문제점 2"],
    "opportunities": ["개선 기회 1", "개선 기회 2"]
  },
  "suggestions": [
    {
      "productName": "개선된 상품명 1",
      "reason": "핵심 키워드 앞쪽 배치, 구체적인 특징 강조",
      "expectedImprovement": "클릭률 20% 향상 예상"
    },
    {
      "productName": "개선된 상품명 2",
      "reason": "시즌 키워드 추가, 혜택 강조",
      "expectedImprovement": "검색 노출 30% 증가 예상"
    },
    {
      "productName": "개선된 상품명 3",
      "reason": "타겟 고객 명시, 문제 해결 강조",
      "expectedImprovement": "전환율 15% 향상 예상"
    }
  ]
}
\`\`\`

## 중요 사항
- 반드시 JSON 형식으로만 응답하세요
- 3가지 대안을 모두 제시하세요
- 각 대안은 서로 다른 접근 방식을 사용하세요
- 상품명은 100자 이내로 제한하세요
`.trim();
}

/**
 * 태그 최적화 프롬프트
 */
export function createTagOptimizationPrompt(data: {
  product: Product;
  currentTags: string[];
  relatedTags: string[]; // 네이버 API에서 가져온 추천 태그
}): string {
  const { product, currentTags, relatedTags } = data;

  return `
당신은 네이버 스마트스토어 태그 최적화 전문가입니다.
검색 노출을 극대화할 수 있는 최적의 태그 조합을 제안하세요.

## 상품 정보
- 상품명: ${product.name}
- 카테고리: ${product.categoryName || '미지정'}
- 가격: ${product.price?.toLocaleString()}원

## 현재 태그
${currentTags.length > 0 ? currentTags.join(', ') : '태그 없음'}

## 추천 태그 후보 (네이버 API 제공)
${relatedTags.length > 0 ? relatedTags.join(', ') : '없음'}

## 태그 최적화 가이드라인

### 1. 태그 선정 원칙
- 최대 5개까지 선택 (네이버 제한)
- 검색량이 많은 키워드 우선
- 상품과 직접적 관련성이 높은 태그
- 경쟁이 적은 롱테일 키워드 포함

### 2. 태그 우선순위
1순위: 제품 카테고리 (예: "노트북", "화장품")
2순위: 브랜드명 (예: "삼성", "애플")
3순위: 핵심 특징 (예: "무선", "방수")
4순위: 타겟 고객 (예: "대학생", "주부")
5순위: 용도/상황 (예: "선물", "데일리")

### 3. 피해야 할 태그
- 상품과 무관한 인기 키워드
- 너무 포괄적인 태그 (예: "좋은 제품")
- 의미가 중복되는 태그

## 분석 요청
1. **현재 태그 평가**
   - 잘 선정된 태그와 개선이 필요한 태그 구분

2. **최적 태그 조합 제안**
   - 5개 이내로 구성
   - 각 태그 선정 이유 설명

## 응답 형식 (반드시 JSON으로만 응답하세요)
\`\`\`json
{
  "currentTagsAnalysis": {
    "goodTags": ["유지할 태그 1", "유지할 태그 2"],
    "removeTags": [
      {
        "tag": "제거할 태그",
        "reason": "상품과 관련성 낮음"
      }
    ]
  },
  "suggestedTags": [
    {
      "tag": "추천 태그 1",
      "priority": 1,
      "reason": "제품 카테고리, 검색량 높음"
    },
    {
      "tag": "추천 태그 2",
      "priority": 2,
      "reason": "브랜드명, 충성 고객 확보"
    }
  ],
  "finalRecommendation": ["최종 태그 1", "최종 태그 2", "최종 태그 3", "최종 태그 4", "최종 태그 5"]
}
\`\`\`

## 중요 사항
- 반드시 JSON 형식으로만 응답하세요
- finalRecommendation은 정확히 5개 이하로 제한하세요
- 추천 태그 후보를 최대한 활용하되, 상품과 맞지 않으면 과감히 제외하세요
`.trim();
}

/**
 * A/B 테스트 설계 프롬프트
 */
export function createABTestDesignPrompt(data: {
  product: Product;
  testType: 'product_name' | 'tags' | 'category';
  currentValue: string | string[];
  stats: {
    views: number;
    clicks: number;
    conversions: number;
    clickRate: number;
    conversionRate: number;
  };
}): string {
  const { product, testType, currentValue, stats } = data;

  const testTypeKorean =
    testType === 'product_name' ? '상품명' : testType === 'tags' ? '태그' : '카테고리';

  return `
당신은 A/B 테스트 설계 전문가입니다.
${testTypeKorean} 최적화를 위한 A/B 테스트 계획을 수립하세요.

## 상품 정보
- 상품명: ${product.name}
- 카테고리: ${product.categoryName || '미지정'}
- 태그: ${product.tags?.join(', ') || '없음'}
- 가격: ${product.price?.toLocaleString()}원

## 테스트 대상
- 테스트 타입: ${testTypeKorean}
- 현재 값 (대조군, Variant A):
${typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2)}

## 현재 성과 (최근 14일)
- 조회수: ${stats.views.toLocaleString()}
- 클릭수: ${stats.clicks.toLocaleString()}
- 전환수: ${stats.conversions.toLocaleString()}
- 클릭률(CTR): ${stats.clickRate.toFixed(2)}%
- 전환율: ${stats.conversionRate.toFixed(2)}%

## A/B 테스트 설계 가이드라인

### 1. 테스트 원칙
- 한 번에 하나의 변수만 변경
- 명확한 가설 수립
- 측정 가능한 지표 설정
- 충분한 샘플 사이즈 확보

### 2. 변경안(Variant B) 설계
- 현재값과 명확히 구분되는 변경
- 가설 검증이 가능한 수준의 차이
- 실제 적용 가능한 현실적인 안

### 3. 측정 지표
- 주 지표: 전환율 (Conversion Rate)
- 부 지표: 클릭률(CTR), 조회수
- 최소 개선율: 5% 이상

### 4. 테스트 기간
- 표준: 14일 (2주)
- 최소 샘플: 조회수 100회 이상
- 통계적 유의성 확보

## 요청 사항
1. **가설 수립**
   - 무엇을 검증하려는가?
   - 왜 이 변경이 효과적일 것으로 예상하는가?

2. **변경안 설계**
   - Variant A (대조군): 현재 값
   - Variant B (실험군): 개선안

3. **성공 기준**
   - 어떤 지표가 얼마나 개선되어야 하는가?

## 응답 형식 (반드시 JSON으로만 응답하세요)
\`\`\`json
{
  "hypothesis": "구체적인 키워드를 추가하면 검색 정확도가 높아져 클릭률이 15% 향상될 것이다",
  "variantA": {
    "value": ${typeof currentValue === 'string' ? `"${currentValue}"` : JSON.stringify(currentValue)},
    "description": "현재 사용 중인 ${testTypeKorean} (대조군)"
  },
  "variantB": {
    "value": "개선된 값",
    "description": "검색 키워드 최적화를 적용한 ${testTypeKorean} (실험군)"
  },
  "expectedResults": {
    "primaryMetric": "전환율",
    "expectedImprovement": "15%",
    "secondaryMetrics": ["클릭률 10% 증가", "조회수 20% 증가"]
  },
  "testDuration": 14,
  "minSampleSize": 100,
  "successCriteria": "전환율이 5% 이상 개선되고 통계적으로 유의미한 경우 (p < 0.05)"
}
\`\`\`

## 중요 사항
- 반드시 JSON 형식으로만 응답하세요
- 가설은 명확하고 검증 가능해야 합니다
- Variant B는 Variant A와 명확히 구분되어야 합니다
- 성공 기준은 측정 가능하고 현실적이어야 합니다
`.trim();
}

/**
 * 상품 최적화 시스템 프롬프트
 */
export const PRODUCT_OPTIMIZATION_SYSTEM_PROMPT = `
당신은 네이버 스마트스토어 상품 최적화 전문가입니다.
데이터 분석을 기반으로 검색 노출, 클릭률, 전환율을 향상시키는 실행 가능한 개선안을 제시합니다.

핵심 원칙:
1. 네이버 검색 알고리즘과 스마트스토어 정책 준수
2. 고객 검색 의도를 정확히 파악하여 관련성 높은 키워드 사용
3. A/B 테스트를 통한 과학적 의사결정
4. 측정 가능한 지표로 개선 효과 검증

응답은 반드시 유효한 JSON 형식이어야 합니다.
`.trim();
