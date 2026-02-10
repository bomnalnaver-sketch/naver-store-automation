/**
 * @file keyword-reorder.ts
 * @description 상품명 키워드 순서 자동 조정 엔진
 * @responsibilities
 * - 키워드별 우선순위 점수 계산 (검색순위 + 판매기여도)
 * - 키워드 유형 제약 조건 준수한 재배치
 * - 최적화된 상품명 생성
 */

import { db } from '@/db/client';
import {
  tokenize,
  joinKeyword,
  containsTokenInOrder,
} from '@/services/keyword-classification/keyword-tokenizer';
import { calculateOptimizationScore } from './scoring-engine';
import { extractExposedKeywords } from './exposure-simulator';
import type { KeywordMaster } from '@/types/keyword.types';
import { logger } from '@/utils/logger';

/** 상품명 최대 길이 (네이버 제한) */
const MAX_PRODUCT_NAME_LENGTH = 100;

/**
 * 키워드 유닛: 재배치의 최소 단위
 * integral/order_fixed는 여러 토큰이 하나의 유닛
 */
interface KeywordUnit {
  tokens: string[];
  keyword: KeywordMaster | null;
  priorityScore: number;
  isIntegral: boolean;
}

/**
 * 재배치 결과
 */
export interface ReorderResult {
  reorderedName: string;
  changed: boolean;
  currentScore: number;
  newScore: number;
  unitDetails: {
    keyword: string;
    priorityScore: number;
    rank: number | null;
    contributionScore: number;
  }[];
}

// ============================================
// 우선순위 점수 계산
// ============================================

/**
 * 검색순위를 점수로 변환 (0~100)
 */
function rankToScore(rank: number | null): number {
  if (rank === null) return 10;
  if (rank <= 10) return 100;
  if (rank <= 40) return 80;
  if (rank <= 100) return 60;
  if (rank <= 500) return 40;
  return 20;
}

/**
 * 키워드 우선순위 점수 계산
 * priorityScore = rankScore * 0.5 + salesScore * 0.5
 */
function calculatePriorityScore(
  rank: number | null,
  contributionScore: number
): number {
  const rankScore = rankToScore(rank);
  const salesScore = Math.min(100, Math.max(0, contributionScore));
  return rankScore * 0.5 + salesScore * 0.5;
}

// ============================================
// DB 조회
// ============================================

/**
 * 키워드별 최신 순위 조회
 */
async function fetchLatestRanks(
  productId: number
): Promise<Map<string, number>> {
  const sql = `
    SELECT DISTINCT ON (keyword)
      keyword, rank
    FROM keyword_ranking_daily
    WHERE product_id = $1
      AND rank IS NOT NULL
    ORDER BY keyword, checked_at DESC
  `;

  const rows = await db.queryMany<{ keyword: string; rank: number }>(sql, [
    productId,
  ]);

  const rankMap = new Map<string, number>();
  for (const row of rows) {
    rankMap.set(row.keyword.toLowerCase(), row.rank);
  }
  return rankMap;
}

/**
 * 키워드별 판매 기여도 조회
 */
async function fetchContributionScores(
  productId: number
): Promise<Map<string, number>> {
  const sql = `
    SELECT keyword, contribution_score
    FROM keyword_candidates
    WHERE product_id = $1
      AND contribution_score IS NOT NULL
  `;

  const rows = await db.queryMany<{
    keyword: string;
    contribution_score: number;
  }>(sql, [productId]);

  const scoreMap = new Map<string, number>();
  for (const row of rows) {
    scoreMap.set(row.keyword.toLowerCase(), Number(row.contribution_score));
  }
  return scoreMap;
}

// ============================================
// 유닛 식별
// ============================================

/**
 * 상품명 토큰에서 키워드 유닛을 식별
 * integral/order_fixed 키워드는 여러 토큰을 하나의 유닛으로 묶음
 */
function identifyKeywordUnits(
  productName: string,
  tokens: string[],
  keywordDb: KeywordMaster[]
): KeywordUnit[] {
  // 이미 유닛에 할당된 토큰 인덱스 추적
  const assignedIndices = new Set<number>();
  const units: KeywordUnit[] = [];

  // 1. integral 키워드 처리 (붙여쓰기 형태)
  const integralKeywords = keywordDb.filter(
    (kw) => kw.keywordType === 'integral'
  );
  const nameLower = productName.toLowerCase();

  for (const kw of integralKeywords) {
    const joined = joinKeyword(kw.keyword).toLowerCase();
    if (!nameLower.includes(joined)) continue;

    // 토큰 중에서 이 일체형 키워드에 해당하는 것 찾기
    for (let i = 0; i < tokens.length; i++) {
      if (assignedIndices.has(i)) continue;
      if (tokens[i]!.toLowerCase() === joined) {
        assignedIndices.add(i);
        units.push({
          tokens: [tokens[i]!],
          keyword: kw,
          priorityScore: 0,
          isIntegral: true,
        });
        break;
      }
    }
  }

  // 2. order_fixed 키워드 처리 (나란히 배치된 토큰들)
  const orderFixedKeywords = keywordDb.filter(
    (kw) => kw.keywordType === 'order_fixed'
  );

  for (const kw of orderFixedKeywords) {
    const kwTokens = tokenize(kw.keyword);
    if (kwTokens.length < 2) continue;
    if (!containsTokenInOrder(productName, kwTokens)) continue;

    // 상품명 토큰에서 연속 위치 찾기
    const startIdx = findConsecutiveTokens(tokens, kwTokens, assignedIndices);
    if (startIdx === -1) continue;

    const unitTokens: string[] = [];
    for (let i = 0; i < kwTokens.length; i++) {
      const idx = startIdx + i;
      assignedIndices.add(idx);
      unitTokens.push(tokens[idx]!);
    }

    units.push({
      tokens: unitTokens,
      keyword: kw,
      priorityScore: 0,
      isIntegral: false,
    });
  }

  // 3. 나머지 토큰 → 개별 유닛
  for (let i = 0; i < tokens.length; i++) {
    if (assignedIndices.has(i)) continue;

    const token = tokens[i]!;
    const tokenLower = token.toLowerCase();

    // 매핑된 키워드 찾기 (composite, synonym 등)
    const matchedKw = keywordDb.find(
      (kw) =>
        kw.keyword.toLowerCase() === tokenLower ||
        tokenize(kw.keyword).some((t) => t.toLowerCase() === tokenLower)
    );

    units.push({
      tokens: [token],
      keyword: matchedKw || null,
      priorityScore: 0,
      isIntegral: false,
    });
  }

  return units;
}

/**
 * 토큰 배열에서 연속된 키워드 토큰의 시작 인덱스 찾기
 */
function findConsecutiveTokens(
  nameTokens: string[],
  kwTokens: string[],
  excludeIndices: Set<number>
): number {
  for (let i = 0; i <= nameTokens.length - kwTokens.length; i++) {
    let match = true;
    for (let j = 0; j < kwTokens.length; j++) {
      const idx = i + j;
      if (excludeIndices.has(idx)) {
        match = false;
        break;
      }
      if (nameTokens[idx]!.toLowerCase() !== kwTokens[j]!.toLowerCase()) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

// ============================================
// 메인 함수
// ============================================

/**
 * 상품명 키워드 순서 자동 재배치
 * 검색순위 + 판매기여도 기반으로 키워드를 앞쪽에 배치
 * @param productId 상품 ID
 * @param productName 현재 상품명
 * @param keywordDb 매핑된 키워드 목록 (외부 전달 가능)
 * @param redundantDict 불필요 키워드 사전 (외부 전달 가능)
 */
export async function reorderProductKeywords(
  productId: number,
  productName: string,
  keywordDb?: KeywordMaster[],
  redundantDict?: string[]
): Promise<ReorderResult> {
  logger.info('키워드 순서 재배치 시작', { productId, productName });

  // 1. 데이터 수집
  const [rankMap, contribMap] = await Promise.all([
    fetchLatestRanks(productId),
    fetchContributionScores(productId),
  ]);

  // 2. 상품명 파싱
  const tokens = tokenize(productName);
  if (tokens.length <= 1) {
    return {
      reorderedName: productName,
      changed: false,
      currentScore: 0,
      newScore: 0,
      unitDetails: [],
    };
  }

  // 3. keywordDb가 없으면 빈 배열 (외부에서 전달 안 한 경우)
  const keywords = keywordDb || [];

  // 4. 키워드 유닛 식별
  const units = identifyKeywordUnits(productName, tokens, keywords);

  // 5. 각 유닛에 우선순위 점수 부여
  const unitDetails: ReorderResult['unitDetails'] = [];

  for (const unit of units) {
    if (unit.keyword) {
      const kwLower = unit.keyword.keyword.toLowerCase();
      const rank = rankMap.get(kwLower) ?? null;
      const contrib = contribMap.get(kwLower) ?? 0;
      unit.priorityScore = calculatePriorityScore(rank, contrib);

      unitDetails.push({
        keyword: unit.keyword.keyword,
        priorityScore: unit.priorityScore,
        rank,
        contributionScore: contrib,
      });
    } else {
      // 비키워드 토큰: 점수 -1 (맨 뒤로)
      unit.priorityScore = -1;

      unitDetails.push({
        keyword: unit.tokens.join(' '),
        priorityScore: -1,
        rank: null,
        contributionScore: 0,
      });
    }
  }

  // 6. 정렬: 키워드 유닛(점수 내림차순) → 비키워드(원래 순서)
  const keywordUnits = units
    .filter((u) => u.keyword !== null)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const nonKeywordUnits = units.filter((u) => u.keyword === null);

  const sortedUnits = [...keywordUnits, ...nonKeywordUnits];

  // 7. 재구성
  const reorderedParts: string[] = [];
  for (const unit of sortedUnits) {
    if (unit.isIntegral) {
      // 일체형: 붙여쓰기
      reorderedParts.push(unit.tokens.join(''));
    } else {
      // order_fixed, composite, 비키워드: 띄어쓰기
      reorderedParts.push(unit.tokens.join(' '));
    }
  }

  let reorderedName = reorderedParts.join(' ');

  // 100자 제한
  if (reorderedName.length > MAX_PRODUCT_NAME_LENGTH) {
    reorderedName = reorderedName.substring(0, MAX_PRODUCT_NAME_LENGTH).trim();
  }

  // 8. 변경 여부 확인
  const changed = reorderedName !== productName;

  if (!changed) {
    logger.info('키워드 순서 변경 불필요', { productId });
    return {
      reorderedName: productName,
      changed: false,
      currentScore: 0,
      newScore: 0,
      unitDetails,
    };
  }

  // 9. 점수 비교 검증 (keywordDb가 있는 경우에만)
  let currentScore = 0;
  let newScore = 0;

  if (keywords.length > 0) {
    const dict = redundantDict || [];
    const currentResult = calculateOptimizationScore(
      productName,
      keywords,
      dict
    );
    const newResult = calculateOptimizationScore(
      reorderedName,
      keywords,
      dict
    );

    currentScore = currentResult.finalScore;
    newScore = newResult.finalScore;

    // 점수가 하락하면 적용하지 않음
    if (newScore < currentScore) {
      logger.warn('재배치 후 점수 하락 — 적용 취소', {
        productId,
        currentScore,
        newScore,
        currentName: productName,
        reorderedName,
      });
      return {
        reorderedName: productName,
        changed: false,
        currentScore,
        newScore,
        unitDetails,
      };
    }

    // 노출 키워드 수 감소 확인
    const currentExposed = extractExposedKeywords(productName, keywords);
    const newExposed = extractExposedKeywords(reorderedName, keywords);

    if (newExposed.length < currentExposed.length) {
      logger.warn('재배치 후 노출 키워드 감소 — 적용 취소', {
        productId,
        currentExposedCount: currentExposed.length,
        newExposedCount: newExposed.length,
      });
      return {
        reorderedName: productName,
        changed: false,
        currentScore,
        newScore,
        unitDetails,
      };
    }
  }

  logger.info('키워드 순서 재배치 완료', {
    productId,
    currentName: productName,
    reorderedName,
    currentScore,
    newScore,
    unitCount: units.length,
  });

  return {
    reorderedName,
    changed: true,
    currentScore,
    newScore,
    unitDetails,
  };
}
