/**
 * @file keyword-tokenizer.ts
 * @description 키워드/상품명 토큰 분리 유틸리티
 * @responsibilities
 * - HTML 태그 제거
 * - 텍스트 토큰 분리
 * - N-gram 조합 생성 (붙여쓰기 + 띄어쓰기)
 * - 키워드 순서 반전 / 붙여쓰기
 * - 토큰 포함 여부 검사
 */

// ============================================
// HTML 처리
// ============================================

/**
 * HTML 태그 제거
 * 네이버 쇼핑 검색 결과의 title에 포함된 <b>, </b> 등을 제거
 * @param text HTML 태그가 포함된 텍스트
 * @returns 태그가 제거된 순수 텍스트
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

// ============================================
// 토큰 분리
// ============================================

/**
 * 텍스트를 공백 기준으로 토큰 분리
 * HTML 태그 제거 후 공백으로 분리, 빈 문자열 제거
 * @param text 분리할 텍스트
 * @returns 토큰 배열
 */
export function tokenize(text: string): string[] {
  const cleaned = stripHtmlTags(text);
  return cleaned.split(/\s+/).filter((token) => token.length > 0);
}

// ============================================
// 조합 생성
// ============================================

/**
 * 모든 연속 N-gram 조합 생성
 * 각 조합에 대해 붙여쓰기 + 띄어쓰기 두 가지 형태를 생성
 * @param tokens 토큰 배열
 * @param minN 최소 토큰 수 (기본: 2)
 * @param maxN 최대 토큰 수 (기본: tokens.length)
 * @returns 조합 문자열 배열 (붙여쓰기 + 띄어쓰기 모두 포함)
 *
 * @example
 * generateCombinations(['에어', '조던', '신발'])
 * // → ['에어조던', '에어 조던', '조던신발', '조던 신발', '에어조던신발', '에어 조던 신발']
 */
export function generateCombinations(
  tokens: string[],
  minN: number = 2,
  maxN: number = tokens.length
): string[] {
  const combinations: string[] = [];
  const effectiveMaxN = Math.min(maxN, tokens.length);

  for (let n = minN; n <= effectiveMaxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const slice = tokens.slice(i, i + n);
      const joined = slice.join('');
      const spaced = slice.join(' ');

      combinations.push(joined);

      // 붙여쓰기와 띄어쓰기가 다를 때만 추가
      if (joined !== spaced) {
        combinations.push(spaced);
      }
    }
  }

  return combinations;
}

// ============================================
// 키워드 변환
// ============================================

/**
 * 키워드 단어 순서 반전
 * @param keyword 원본 키워드
 * @returns 순서가 반전된 키워드
 *
 * @example
 * reverseKeyword('에어 조던') // → '조던 에어'
 * reverseKeyword('나이키 에어 조던') // → '조던 에어 나이키'
 */
export function reverseKeyword(keyword: string): string {
  const tokens = tokenize(keyword);
  return tokens.reverse().join(' ');
}

/**
 * 키워드 띄어쓰기 제거 (붙여쓰기)
 * @param keyword 원본 키워드
 * @returns 공백이 제거된 키워드
 *
 * @example
 * joinKeyword('에어 조던') // → '에어조던'
 */
export function joinKeyword(keyword: string): string {
  return keyword.replace(/\s+/g, '');
}

// ============================================
// 토큰 검색
// ============================================

/**
 * 텍스트에 토큰이 포함되는지 확인 (대소문자 무시)
 * HTML 태그 제거 후 검사
 * @param text 검색 대상 텍스트
 * @param token 검색할 토큰
 * @returns 포함 여부
 */
export function containsToken(text: string, token: string): boolean {
  const cleanedText = stripHtmlTags(text).toLowerCase();
  const lowerToken = token.toLowerCase();
  return cleanedText.includes(lowerToken);
}

/**
 * 텍스트 내에서 토큰들이 순서대로 나란히 존재하는지 확인
 * 붙여쓰기, 띄어쓰기 모두 허용
 * @param text 검색 대상 텍스트
 * @param tokens 순서대로 확인할 토큰 배열
 * @returns 순서대로 나란히 존재하는지 여부
 *
 * @example
 * containsTokenInOrder('나이키 에어조던 운동화', ['에어', '조던']) // → true (붙여쓰기)
 * containsTokenInOrder('나이키 에어 조던 운동화', ['에어', '조던']) // → true (띄어쓰기)
 * containsTokenInOrder('조던 에어 운동화', ['에어', '조던']) // → false (순서 반대)
 */
export function containsTokenInOrder(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;

  const cleanedText = stripHtmlTags(text).toLowerCase();

  // 붙여쓰기 형태로 순서대로 존재하는지 확인
  const joinedPattern = tokens.map((t) => t.toLowerCase()).join('');
  if (cleanedText.includes(joinedPattern)) return true;

  // 띄어쓰기 형태로 순서대로 존재하는지 확인
  const spacedPattern = tokens.map((t) => t.toLowerCase()).join(' ');
  if (cleanedText.includes(spacedPattern)) return true;

  return false;
}
