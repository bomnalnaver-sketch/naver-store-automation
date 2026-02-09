/**
 * @file source-tokenizer.ts
 * @description 상품명 토큰화 기반 키워드 발굴
 * @responsibilities
 * - 상품명에서 토큰 추출
 * - N-gram 조합 생성
 * - 기존 등록 키워드 제외
 */

import {
  tokenize,
  generateCombinations,
} from '@/services/keyword-classification/keyword-tokenizer';
import { DiscoveredKeyword } from '@/types/keyword.types';
import { logger } from '@/utils/logger';

/**
 * 상품명 토큰화 발굴 입력
 */
export interface TokenizerDiscoveryInput {
  productId: number;
  productName: string;
  existingKeywords: string[];
}

/**
 * 상품명 토큰화 발굴 결과
 */
export interface TokenizerDiscoveryResult {
  productId: number;
  productName: string;
  tokens: string[];
  combinations: string[];
  discoveredKeywords: DiscoveredKeyword[];
}

/** 최소 토큰 길이 */
const MIN_TOKEN_LENGTH = 2;

/** 최대 조합 토큰 수 */
const MAX_COMBINATION_TOKENS = 4;

/** 무시할 단어 (조사, 특수문자 등) */
const IGNORE_WORDS = new Set([
  // 조사
  '의',
  '를',
  '을',
  '이',
  '가',
  '에',
  '에서',
  '로',
  '으로',
  '와',
  '과',
  '도',
  '만',
  '은',
  '는',
  // 무의미 수식어
  '추천',
  '인기',
  '베스트',
  '핫딜',
  '특가',
  '세일',
  '할인',
  // 특수문자/숫자만 포함
]);

/**
 * 토큰 유효성 검사
 * @param token 검사할 토큰
 * @returns 유효 여부
 */
function isValidToken(token: string): boolean {
  // 길이 체크
  if (token.length < MIN_TOKEN_LENGTH) return false;

  // 무시 단어 체크
  if (IGNORE_WORDS.has(token.toLowerCase())) return false;

  // 숫자만으로 구성된 경우 제외
  if (/^\d+$/.test(token)) return false;

  // 특수문자만으로 구성된 경우 제외
  if (/^[^a-zA-Z가-힣0-9]+$/.test(token)) return false;

  return true;
}

/**
 * 조합 키워드 유효성 검사
 * @param combination 검사할 조합
 * @returns 유효 여부
 */
function isValidCombination(combination: string): boolean {
  // 최소 길이 체크
  if (combination.length < 3) return false;

  // 한글 또는 영문이 최소 1자 이상 포함
  if (!/[가-힣a-zA-Z]/.test(combination)) return false;

  return true;
}

/**
 * 상품명에서 키워드 발굴
 * @param input 발굴 입력
 * @returns 발굴 결과
 */
export async function discoverFromProductName(
  input: TokenizerDiscoveryInput
): Promise<TokenizerDiscoveryResult> {
  const { productId, productName, existingKeywords } = input;

  logger.debug('상품명 토큰화 키워드 발굴 시작', {
    productId,
    productName,
  });

  // 1. 토큰화
  const rawTokens = tokenize(productName);
  const validTokens = rawTokens.filter(isValidToken);

  // 2. N-gram 조합 생성 (2~4개 토큰)
  const rawCombinations = generateCombinations(
    validTokens,
    2,
    MAX_COMBINATION_TOKENS
  );

  // 3. 유효한 조합만 필터
  const validCombinations = rawCombinations.filter(isValidCombination);

  // 4. 기존 키워드 제외 (대소문자 무시)
  const existingSet = new Set(existingKeywords.map((k) => k.toLowerCase()));
  const newCombinations = validCombinations.filter(
    (c) => !existingSet.has(c.toLowerCase())
  );

  // 5. 중복 제거
  const uniqueCombinations = [...new Set(newCombinations)];

  // 6. DiscoveredKeyword 형태로 변환
  const discoveredKeywords: DiscoveredKeyword[] = uniqueCombinations.map(
    (keyword) => ({
      keyword,
      source: 'product_name' as const,
      sourceDetails: [productName],
    })
  );

  logger.info('상품명 토큰화 키워드 발굴 완료', {
    productId,
    tokenCount: validTokens.length,
    combinationCount: validCombinations.length,
    newKeywordsCount: discoveredKeywords.length,
  });

  return {
    productId,
    productName,
    tokens: validTokens,
    combinations: validCombinations,
    discoveredKeywords,
  };
}

/**
 * 단일 토큰도 키워드로 발굴 (옵션)
 * 일반적으로 2-gram 이상만 사용하지만, 필요시 단일 토큰도 추가
 */
export function discoverSingleTokens(
  tokens: string[],
  existingKeywords: string[]
): DiscoveredKeyword[] {
  const existingSet = new Set(existingKeywords.map((k) => k.toLowerCase()));

  return tokens
    .filter((token) => isValidToken(token) && token.length >= 3)
    .filter((token) => !existingSet.has(token.toLowerCase()))
    .map((keyword) => ({
      keyword,
      source: 'product_name' as const,
    }));
}
