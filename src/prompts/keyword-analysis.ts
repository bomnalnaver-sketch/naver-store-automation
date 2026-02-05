/**
 * @file keyword-analysis.ts
 * @description 키워드 분석 AI 프롬프트
 * @responsibilities
 * - 키워드 평가 프롬프트 생성
 * - 키워드 발굴 프롬프트 생성
 * - 구조화된 응답 형식 정의
 */

import type { KeywordWithStats } from '@/types/ai.types';
import type { Product } from '@/types/db.types';
import type { SearchAdRelatedKeyword } from '@/types/naver-api.types';

/**
 * 키워드 평가 프롬프트 생성
 */
export function createKeywordEvaluationPrompt(data: {
  keywords: KeywordWithStats[];
  config: {
    maxKeywordsPerProduct: number;
    minRoasThreshold: number;
    testProtectionDays: number;
  };
}): string {
  const { keywords, config } = data;

  return `
당신은 네이버 스마트스토어 검색광고 전문가입니다.
다음 키워드들의 성과를 분석하고, 각 키워드에 대한 액션을 제안하세요.

## 키워드 데이터
${JSON.stringify(keywords, null, 2)}

## 평가 기준
1. **ROAS (광고 수익률)**: ${config.minRoasThreshold}% 이상이어야 합니다
   - ROAS = (매출 / 광고비) × 100
   - 예: 10만원 광고비로 15만원 매출 → ROAS 150%

2. **테스트 보호 기간**: 생성 후 ${config.testProtectionDays}일 이내의 키워드는 제거하지 않습니다
   - 충분한 데이터 수집을 위한 최소 기간
   - isTest=true인 키워드는 추가 보호

3. **상품당 키워드 개수 제한**: 최대 ${config.maxKeywordsPerProduct}개
   - 성과가 좋은 키워드만 유지
   - 저성과 키워드는 제거하여 예산 절감

4. **추가 고려사항**
   - 클릭률(CTR)이 높을수록 좋음
   - 전환율이 높을수록 좋음
   - 평균 클릭 비용이 낮을수록 좋음
   - 노출수가 너무 낮으면 데이터 부족

## 액션 타입
- **remove**: 성과가 좋지 않아 제거해야 하는 키워드
- **update**: 입찰가 조정이 필요한 키워드 (잘 나가면 올리고, 안 나가면 내림)
- **keep**: 현재 성과가 좋아 유지해야 하는 키워드

## 응답 형식 (반드시 JSON으로만 응답하세요)
\`\`\`json
{
  "actions": [
    {
      "type": "remove",
      "keywordId": "키워드ID",
      "reason": "ROAS 70% (기준: ${config.minRoasThreshold}%), 전환율 0.5% 저조"
    },
    {
      "type": "update",
      "keywordId": "키워드ID",
      "bidAmount": 500,
      "reason": "ROAS 200%로 우수, 노출 증대를 위해 입찰가 상향 (300원→500원)"
    },
    {
      "type": "keep",
      "keywordId": "키워드ID",
      "reason": "ROAS 180%, 전환율 3.2%로 우수한 성과 유지 중"
    }
  ],
  "summary": {
    "totalKeywords": ${keywords.length},
    "toRemove": 0,
    "toUpdate": 0,
    "toKeep": 0
  }
}
\`\`\`

## 중요 사항
- 반드시 JSON 형식으로만 응답하세요
- 모든 키워드에 대해 액션을 제시해야 합니다
- reason은 구체적인 수치와 근거를 포함하세요
- update 액션 시 bidAmount는 현재 입찰가의 ±30% 범위 내에서 조정하세요
`.trim();
}

/**
 * 키워드 발굴 프롬프트 생성
 */
export function createKeywordDiscoveryPrompt(data: {
  product: Product;
  relatedKeywords: SearchAdRelatedKeyword[];
  testedKeywords: string[]; // 과거에 테스트했던 키워드 (실패한 키워드)
  currentKeywords: string[]; // 현재 운영 중인 키워드
}): string {
  const { product, relatedKeywords, testedKeywords, currentKeywords } = data;

  return `
당신은 네이버 스마트스토어 검색광고 전문가입니다.
상품에 적합한 새로운 광고 키워드를 발굴하세요.

## 상품 정보
- 상품명: ${product.name}
- 카테고리: ${product.categoryName || '미지정'}
- 태그: ${product.tags?.join(', ') || '없음'}
- 가격: ${product.price?.toLocaleString()}원

## 연관 키워드 후보 (네이버 검색광고 API 제공)
${JSON.stringify(
  relatedKeywords.map((kw) => ({
    keyword: kw.relKeyword,
    monthlySearchCount: kw.monthlyPcQcCnt + kw.monthlyMobileQcCnt,
    competitionLevel: kw.compIdx, // 경쟁 강도 (낮을수록 좋음)
  })),
  null,
  2
)}

## 제외할 키워드
### 이미 테스트했던 키워드 (성과 부족으로 탈락)
${testedKeywords.length > 0 ? testedKeywords.join(', ') : '없음'}

### 현재 운영 중인 키워드 (중복 방지)
${currentKeywords.length > 0 ? currentKeywords.join(', ') : '없음'}

## 키워드 선정 기준
1. **검색량 vs 경쟁강도 분석**
   - 검색량(monthlySearchCount)이 많으면서도
   - 경쟁강도(competitionLevel)가 낮은 키워드 우선

2. **상품 관련성**
   - 상품명, 카테고리, 태그와 관련성이 높은 키워드
   - 구매 의도가 명확한 키워드 (예: "구매", "추천", "리뷰" 등)

3. **중복 제거**
   - 이미 테스트했거나 현재 운영 중인 키워드는 제외
   - 의미가 거의 같은 유사 키워드도 제외

4. **롱테일 키워드 고려**
   - 경쟁이 적고 전환율이 높은 구체적인 키워드
   - 예: "노트북" → "대학생 노트북 추천"

## 요청 사항
- 최대 **5개**의 키워드를 추천하세요
- 각 키워드가 선정된 이유를 간단히 설명하세요

## 응답 형식 (반드시 JSON으로만 응답하세요)
\`\`\`json
{
  "keywords": [
    {
      "keyword": "추천할 키워드",
      "reason": "월 검색량 1,200회, 경쟁강도 낮음(3/10), 구매 의도 명확",
      "estimatedBidAmount": 300
    }
  ]
}
\`\`\`

## 중요 사항
- 반드시 JSON 형식으로만 응답하세요
- 최대 5개까지만 추천하세요
- 제외할 키워드 목록에 있는 키워드는 절대 포함하지 마세요
- estimatedBidAmount는 경쟁강도를 고려하여 200~1000원 사이로 제시하세요
`.trim();
}

/**
 * 키워드 평가 시스템 프롬프트
 */
export const KEYWORD_EVALUATION_SYSTEM_PROMPT = `
당신은 네이버 스마트스토어 검색광고 전문가입니다.
데이터 기반으로 객관적이고 냉철하게 분석하며, 광고비 절감과 수익 극대화를 최우선으로 합니다.

핵심 원칙:
1. ROAS가 기준 미달이면 보호기간이 지났을 때 과감히 제거
2. 성과가 좋은 키워드는 입찰가를 올려 노출 증대
3. 테스트 기간 중인 키워드는 충분한 데이터 수집을 위해 보호
4. 감정이나 추측이 아닌 수치와 데이터로 판단

응답은 반드시 유효한 JSON 형식이어야 합니다.
`.trim();

/**
 * 키워드 발굴 시스템 프롬프트
 */
export const KEYWORD_DISCOVERY_SYSTEM_PROMPT = `
당신은 네이버 검색광고 키워드 발굴 전문가입니다.
검색량, 경쟁강도, 상품 관련성을 종합적으로 분석하여 ROI가 높을 것으로 예상되는 키워드를 선별합니다.

핵심 원칙:
1. 검색량이 많으면서도 경쟁이 적은 블루오션 키워드 발굴
2. 구매 의도가 명확한 키워드 우선 (상품명, 리뷰, 추천 등)
3. 이미 테스트했거나 운영 중인 키워드는 절대 중복 제안하지 않음
4. 롱테일 키워드로 틈새 시장 공략

응답은 반드시 유효한 JSON 형식이어야 합니다.
`.trim();
