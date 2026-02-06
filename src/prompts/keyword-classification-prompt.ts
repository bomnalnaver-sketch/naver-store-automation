/**
 * @file keyword-classification-prompt.ts
 * @description 키워드 분류 및 상품명 최적화 AI 프롬프트
 * @responsibilities
 * - 혼합(orange) 키워드 AI 판정 프롬프트
 * - 키워드 유형 기반 상품명 최적화 제안 프롬프트
 * - 키워드 전략 종합 분석 프롬프트
 */

import type { ColorClass, KeywordType, OptimizationScoreResult } from '@/types/keyword.types';

/**
 * 혼합(orange) 키워드 색깔 판정 AI 프롬프트
 * title/category 포함율이 임계값 사이에 있어 자동 분류 불가한 경우
 */
export function createOrangeClassificationPrompt(data: {
  keyword: string;
  titleInclusionRate: number;
  categoryInclusionRate: number;
  topProducts: Array<{
    title: string;
    category: string;
  }>;
}): string {
  const { keyword, titleInclusionRate, categoryInclusionRate, topProducts } = data;

  const top10Products = topProducts.slice(0, 10);

  return `
당신은 네이버 쇼핑 검색 키워드 분류 전문가입니다.
아래 키워드의 "색깔 분류"를 판정해 주세요.

## 대상 키워드
"${keyword}"

## 자동 분류 결과 (임계값 미충족으로 혼합 판정)
- 상품명(title) 포함율: ${titleInclusionRate.toFixed(1)}%
- 카테고리(category) 포함율: ${categoryInclusionRate.toFixed(1)}%

## 상위 10개 상품 데이터
${top10Products.map((p, i) => `${i + 1}. 상품명: ${p.title}\n   카테고리: ${p.category}`).join('\n')}

## 색깔 분류 기준

### 🟡 상품명전용 (yellow)
- 상위 상품들의 상품명에 해당 키워드(또는 구성 단어)가 **거의 전부** 포함
- 카테고리에는 없고 상품명에만 존재하는 키워드
- 예: "여성 니트 가디건", "남자 겨울 패딩"

### ⚪ 카테고리 (gray)
- 상품명보다 **카테고리에 더 많이** 포함되는 키워드
- 네이버 카테고리 구조에 해당하는 일반적 분류명
- 예: "노트북", "화장품", "가전제품"

### 🟢 속성 (green)
- 상품명에 **절반 이상** 포함되지만 전부는 아닌 키워드
- 상품의 속성이나 특징을 나타냄
- 예: "무선", "방수", "USB-C"

### 🔵 태그 (blue)
- 상품명에도 카테고리에도 **잘 나타나지 않는** 키워드
- 연관 검색이나 트렌드성 키워드
- 예: "갓성비", "직장인 추천"

## 응답 형식 (반드시 JSON으로만 응답하세요)
\`\`\`json
{
  "color": "yellow | gray | green | blue",
  "confidence": 0.85,
  "reason": "판정 이유를 구체적으로 설명"
}
\`\`\`

## 중요 사항
- 반드시 JSON 형식으로만 응답하세요
- color는 yellow, gray, green, blue 중 하나만 선택하세요
- confidence는 0.0~1.0 사이 값으로, 판정 확신도를 표현하세요
- reason에는 포함율 수치와 상품 패턴을 근거로 설명하세요
`.trim();
}

/**
 * 혼합 키워드 판정 시스템 프롬프트
 */
export const ORANGE_CLASSIFICATION_SYSTEM_PROMPT = `
당신은 네이버 쇼핑 검색 데이터를 기반으로 키워드를 분류하는 전문가입니다.
쇼핑 검색 상위 상품들의 상품명과 카테고리 패턴을 분석하여 키워드의 성격을 정확히 판별합니다.

핵심 원칙:
1. 수치 데이터(포함율)를 최우선 근거로 활용
2. 상위 상품의 패턴을 면밀히 관찰
3. 애매한 경우 green(속성)으로 보수적 판정
4. 판정 이유를 명확하게 설명

응답은 반드시 유효한 JSON 형식이어야 합니다.
`.trim();

/**
 * 키워드 유형 기반 상품명 최적화 AI 제안 프롬프트
 */
export function createProductNameAiSuggestionPrompt(data: {
  productName: string;
  storeName?: string;
  keywords: Array<{
    keyword: string;
    type: KeywordType;
    color: ColorClass;
    searchVolume?: number;
  }>;
  scoreResult: OptimizationScoreResult;
}): string {
  const { productName, storeName, keywords, scoreResult } = data;

  const keywordInfo = keywords.map((kw) => {
    const typeLabel = KEYWORD_TYPE_LABELS[kw.type];
    const colorLabel = COLOR_CLASS_LABELS[kw.color];
    return `- "${kw.keyword}" [${typeLabel}/${colorLabel}]${kw.searchVolume ? ` 월검색량: ${kw.searchVolume}` : ''}`;
  }).join('\n');

  const penaltyInfo = scoreResult.penalties.length > 0
    ? scoreResult.penalties.map((p) => `- ${p.description} (${p.points}점)`).join('\n')
    : '- 감점 없음';

  const bonusInfo = scoreResult.bonuses.length > 0
    ? scoreResult.bonuses.map((b) => `- ${b.description} (+${b.points}점)`).join('\n')
    : '- 가점 없음';

  return `
당신은 네이버 스마트스토어 상품명 최적화 전문가입니다.
키워드 유형별 작성 규칙을 기반으로 최적의 상품명을 제안해 주세요.

## 현재 상품명
"${productName}"
${storeName ? `\n## 스토어명\n"${storeName}"` : ''}

## 등록된 키워드 (유형/색깔 분류 완료)
${keywordInfo}

## 현재 점수
- 점수: ${scoreResult.finalScore}점 / 등급: ${scoreResult.grade}
- 감점 내역:
${penaltyInfo}
- 가점 내역:
${bonusInfo}

## 키워드 유형별 상품명 작성 규칙

### 조합형 (composite)
- 띄어쓰기로 작성 (예: "여성 니트" → O, "여성니트" → X)
- 구성 단어를 다른 키워드와 공유 가능 (공간 절약)
- 구성 단어 순서는 자유 (검색 시 순서 무관)

### 일체형 (integral)
- 반드시 붙여쓰기 (예: "가디건" → O, "가 디 건" → X)
- 절대 분리하지 않음
- 다른 단어 사이에 끼워넣지 않음

### 순서고정 (order_fixed)
- 단어 순서를 반드시 유지 (예: "핸드폰 케이스" → O, "케이스 핸드폰" → X)
- 두 단어 사이에 다른 단어를 삽입하면 안 됨
- 띄어쓰기는 유지

### 동의어 (synonym)
- 대표어 하나만 상품명에 포함
- 동의어를 중복 사용하면 감점
- 검색량이 더 높은 쪽을 선택

### 불필요 (redundant)
- 상품명에서 제거해야 할 키워드
- "예쁜", "추천", "인기" 등 수식어 → 검색 노출에 기여하지 않음

## 요청 사항
1. 감점 사항을 해결한 개선된 상품명 3개 제안
2. 각 제안마다 예상 점수 변화 설명
3. 키워드 배치 전략 설명

## 응답 형식 (반드시 JSON으로만 응답하세요)
\`\`\`json
{
  "suggestions": [
    {
      "productName": "개선된 상품명",
      "estimatedScore": 92,
      "changes": ["변경사항 1", "변경사항 2"],
      "strategy": "키워드 배치 전략 설명"
    }
  ],
  "keywordPlacementTips": [
    "핵심 키워드를 상품명 앞쪽에 배치",
    "조합형 키워드의 공유 단어를 활용하여 공간 절약"
  ]
}
\`\`\`

## 중요 사항
- 반드시 JSON 형식으로만 응답하세요
- 상품명은 100자(공백 포함) 이내로 제한하세요
- 키워드 유형별 규칙을 반드시 준수하세요
- 3가지 대안은 서로 다른 전략을 사용하세요
`.trim();
}

/**
 * 상품명 최적화 AI 시스템 프롬프트
 */
export const PRODUCT_NAME_AI_SYSTEM_PROMPT = `
당신은 네이버 스마트스토어 검색 알고리즘과 키워드 분류 체계에 정통한 상품명 최적화 전문가입니다.
키워드의 5가지 유형(조합형/일체형/순서고정/동의어/불필요)과 색깔 분류(상품명전용/카테고리/속성/태그)를 이해하고,
이를 기반으로 검색 노출을 극대화하는 상품명을 설계합니다.

핵심 원칙:
1. 유효 키워드(검색 노출에 실제 기여하는 키워드) 수를 최대화
2. 조합형 키워드의 공유 단어를 활용하여 50자 내에 최대한 많은 키워드 포함
3. 일체형 키워드는 절대 분리하지 않음
4. 순서고정 키워드는 순서와 인접성을 반드시 유지
5. 불필요 키워드와 동의어 중복은 반드시 제거

응답은 반드시 유효한 JSON 형식이어야 합니다.
`.trim();

/**
 * 키워드 유형 한글 레이블
 */
const KEYWORD_TYPE_LABELS: Record<KeywordType, string> = {
  composite: '조합형',
  integral: '일체형',
  order_fixed: '순서고정',
  synonym: '동의어',
  redundant: '불필요',
};

/**
 * 색깔 분류 한글 레이블
 */
const COLOR_CLASS_LABELS: Record<ColorClass, string> = {
  yellow: '🟡상품명전용',
  gray: '⚪카테고리',
  green: '🟢속성',
  blue: '🔵태그',
  orange: '🟠혼합',
};
