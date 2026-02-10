/**
 * @file source-tokenizer.ts
 * @description 상품명 토큰화 기반 키워드 발굴
 * @responsibilities
 * - 상품명에서 개별 단어(토큰) 추출
 * - 단일 단어 단위 키워드만 생성 (N-gram 조합 없음)
 * - 기존 등록 키워드 제외
 */

import { tokenize } from '@/services/keyword-classification/keyword-tokenizer';
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

/** 무시할 단어 (조사, 무의미 수식어) */
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
]);

/**
 * 토큰 유효성 검사
 */
function isValidToken(token: string): boolean {
  if (token.length < MIN_TOKEN_LENGTH) return false;
  if (IGNORE_WORDS.has(token.toLowerCase())) return false;
  if (/^\d+$/.test(token)) return false;
  if (/^[^a-zA-Z가-힣0-9]+$/.test(token)) return false;
  // 단위 표기만 있는 경우 제외 (예: 0.5mm, 10kg)
  if (/^\d+\.?\d*(mm|cm|m|kg|g|ml|l|oz|ea|개|장|매|팩|세트)$/i.test(token)) return false;
  return true;
}

/**
 * 상품명에서 단일 단어 키워드 발굴
 * - N-gram 조합 없이 개별 단어만 추출
 * - 네이버 상품명은 단일 단어 위주로 구성됨
 */
export async function discoverFromProductName(
  input: TokenizerDiscoveryInput
): Promise<TokenizerDiscoveryResult> {
  const { productId, productName, existingKeywords } = input;

  logger.debug('상품명 토큰화 키워드 발굴 시작', {
    productId,
    productName,
  });

  // 1. 토큰화 → 개별 단어 추출
  const rawTokens = tokenize(productName);
  const validTokens = rawTokens.filter(isValidToken);

  // 2. 기존 키워드 제외 (대소문자 무시)
  const existingSet = new Set(existingKeywords.map((k) => k.toLowerCase()));
  const newTokens = validTokens.filter(
    (t) => !existingSet.has(t.toLowerCase())
  );

  // 3. 중복 제거 (대소문자 무시하되 원본 유지)
  const seenLower = new Set<string>();
  const uniqueTokens: string[] = [];
  for (const token of newTokens) {
    const lower = token.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      uniqueTokens.push(token);
    }
  }

  // 4. DiscoveredKeyword 형태로 변환
  const discoveredKeywords: DiscoveredKeyword[] = uniqueTokens.map(
    (keyword) => ({
      keyword,
      source: 'product_name' as const,
      sourceDetails: [productName],
    })
  );

  logger.info('상품명 토큰화 키워드 발굴 완료', {
    productId,
    tokenCount: validTokens.length,
    newKeywordsCount: discoveredKeywords.length,
  });

  return {
    productId,
    productName,
    tokens: validTokens,
    combinations: [], // N-gram 조합 없음
    discoveredKeywords,
  };
}
