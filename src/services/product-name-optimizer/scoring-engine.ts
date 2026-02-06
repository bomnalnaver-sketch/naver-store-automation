/**
 * @file scoring-engine.ts
 * @description 상품명 최적화 점수 산출 엔진
 * @responsibilities
 * - 감점 체커 6개 (R-01, S-01, I-01, O-01, O-02, C-01)
 * - 가점 체커 3개 (조합형 공간 절약, 키워드 밀도, 일체형 정확 기재)
 * - 최종 점수 산출 및 등급 판정
 */

import { SCORING_CONFIG } from '@/config/app-config';
import { tokenize, joinKeyword, containsToken, containsTokenInOrder } from '@/services/keyword-classification/keyword-tokenizer';
import type { KeywordMaster, PenaltyItem, BonusItem, OptimizationScoreResult, ScoreGrade } from '@/types/keyword.types';
import { logger } from '@/utils/logger';

const { BASE_SCORE, GRADE_THRESHOLDS, PENALTIES, BONUSES } = SCORING_CONFIG;

/** 상품명 최적화 점수 산출 */
export function calculateOptimizationScore(
  productName: string,
  keywordDb: KeywordMaster[],
  redundantDict: string[] = []
): OptimizationScoreResult {
  const tokens = tokenize(productName);

  logger.debug('Scoring engine started', { productName, tokenCount: tokens.length });

  const penalties: PenaltyItem[] = [
    ...checkRedundantKeywords(tokens, redundantDict),
    ...checkSynonymDuplicates(tokens, keywordDb),
    ...checkIntegralSplit(productName, keywordDb),
    ...checkOrderFixedWrong(productName, keywordDb),
    ...checkOrderFixedInsert(productName, keywordDb),
    ...checkCompositeRepeat(tokens, keywordDb),
  ];

  const validKeywords = extractValidKeywordStrings(tokens, keywordDb);
  const bonuses: BonusItem[] = [
    ...checkCompositeSpaceSaving(tokens, keywordDb),
    ...checkKeywordDensity(tokens, validKeywords),
    ...checkIntegralCorrect(productName, keywordDb),
  ];

  const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0);
  const totalBonus = bonuses.reduce((sum, b) => sum + b.points, 0);
  const finalScore = Math.max(0, BASE_SCORE + totalBonus + totalPenalty);
  const grade = determineGrade(finalScore);
  const recommendations = penalties.map((p) => p.recommendation);

  logger.info('Scoring engine completed', { finalScore, grade });

  return { baseScore: BASE_SCORE, totalBonus, totalPenalty, finalScore, grade, penalties, bonuses, recommendations };
}

// ============================================
// 감점 체커
// ============================================

/** [R-01] 불필요 키워드 사용 확인 — redundantDict에 포함된 토큰이면 감점 */
export function checkRedundantKeywords(
  tokens: string[],
  redundantDict: string[]
): PenaltyItem[] {
  const penalties: PenaltyItem[] = [];
  const dictLower = redundantDict.map((d) => d.toLowerCase());

  for (const token of tokens) {
    if (dictLower.includes(token.toLowerCase())) {
      penalties.push({
        ruleId: 'R-01',
        type: 'redundant_keyword',
        keyword: token,
        points: PENALTIES.REDUNDANT_KEYWORD,
        description: `불필요 키워드 '${token}' 사용됨`,
        recommendation: `'${token}' 제거 권장. 제거 시 ${token.length}자 공간 확보 가능.`,
      });
    }
  }

  return penalties;
}

/** [S-01] 동의어 쌍 모두 포함 확인 — 같은 synonymGroupId 키워드 2개 이상이면 감점 */
export function checkSynonymDuplicates(
  tokens: string[],
  keywordDb: KeywordMaster[]
): PenaltyItem[] {
  const penalties: PenaltyItem[] = [];
  const synonymGroups = groupBySynonymId(keywordDb);

  for (const [, groupKeywords] of synonymGroups) {
    const foundInName = groupKeywords.filter((kw) =>
      tokens.some((t) => t.toLowerCase() === kw.keyword.toLowerCase())
    );

    if (foundInName.length >= 2) {
      const keywordA = foundInName[0]!.keyword;
      const keywordB = foundInName[1]!.keyword;

      penalties.push({
        ruleId: 'S-01',
        type: 'synonym_duplicate',
        keyword: `${keywordA}, ${keywordB}`,
        points: PENALTIES.SYNONYM_DUPLICATE,
        description: `동의어 '${keywordA}'와 '${keywordB}'가 모두 사용됨`,
        recommendation: `'${keywordA}'와 '${keywordB}'는 동의어. '${keywordB}' 제거 권장.`,
      });
    }
  }

  return penalties;
}

/** [I-01] 일체형 키워드 분리 기재 확인 — 붙여쓰기 없이 개별 토큰만 있으면 감점 */
export function checkIntegralSplit(
  productName: string,
  keywordDb: KeywordMaster[]
): PenaltyItem[] {
  const penalties: PenaltyItem[] = [];
  const integralKeywords = keywordDb.filter((kw) => kw.keywordType === 'integral');
  const nameLower = productName.toLowerCase();

  for (const kw of integralKeywords) {
    const joined = joinKeyword(kw.keyword).toLowerCase();
    const tokens = tokenize(kw.keyword);

    // 붙여쓰기로 존재하지 않는 경우
    if (!nameLower.includes(joined)) {
      // 띄어쓰기 또는 개별 토큰이 모두 존재하면 분리 기재로 판정
      const allTokensPresent = tokens.every((t) => containsToken(productName, t));

      if (allTokensPresent && tokens.length > 1) {
        penalties.push({
          ruleId: 'I-01',
          type: 'integral_split',
          keyword: kw.keyword,
          points: PENALTIES.INTEGRAL_SPLIT,
          description: `일체형 키워드 '${kw.keyword}'가 분리 기재됨`,
          recommendation: `'${kw.keyword}'는 일체형 키워드. 반드시 붙여서 기재. 현재 분리 기재로 노출 불가.`,
        });
      }
    }
  }

  return penalties;
}

/** [O-01] 순서고정 키워드 순서 오류 — 역순 배치 시 감점 */
export function checkOrderFixedWrong(
  productName: string,
  keywordDb: KeywordMaster[]
): PenaltyItem[] {
  const penalties: PenaltyItem[] = [];
  const orderFixedKeywords = keywordDb.filter((kw) => kw.keywordType === 'order_fixed');

  for (const kw of orderFixedKeywords) {
    const tokens = tokenize(kw.keyword);
    if (tokens.length < 2) continue;

    // 정방향으로 존재하면 문제 없음
    if (containsTokenInOrder(productName, tokens)) continue;

    // 역방향으로 존재하면 순서 오류
    const reversedTokens = [...tokens].reverse();
    if (containsTokenInOrder(productName, reversedTokens)) {
      penalties.push({
        ruleId: 'O-01',
        type: 'order_fixed_wrong',
        keyword: kw.keyword,
        points: PENALTIES.ORDER_FIXED_WRONG,
        description: `순서고정 키워드 '${kw.keyword}'가 역순 배치됨`,
        recommendation: `'${kw.keyword}'는 순서고정 키워드. '${tokens.join(' ')}' 순서로 수정 필요.`,
      });
    }
  }

  return penalties;
}

/** [O-02] 순서고정 키워드 사이 삽입 — 토큰 사이에 다른 토큰 삽입 시 감점 */
export function checkOrderFixedInsert(
  productName: string,
  keywordDb: KeywordMaster[]
): PenaltyItem[] {
  const penalties: PenaltyItem[] = [];
  const orderFixedKeywords = keywordDb.filter((kw) => kw.keywordType === 'order_fixed');
  const nameTokens = tokenize(productName);

  for (const kw of orderFixedKeywords) {
    const kwTokens = tokenize(kw.keyword);
    if (kwTokens.length < 2) continue;

    // 나란히 존재하면 문제 없음
    if (containsTokenInOrder(productName, kwTokens)) continue;

    // 개별 토큰이 모두 존재하지만 사이에 다른 토큰이 있는지 확인
    const allPresent = kwTokens.every((t) =>
      nameTokens.some((nt) => nt.toLowerCase() === t.toLowerCase())
    );

    if (allPresent) {
      const insertedTokens = findInsertedTokens(nameTokens, kwTokens);

      if (insertedTokens.length > 0) {
        penalties.push({
          ruleId: 'O-02',
          type: 'order_fixed_insert',
          keyword: kw.keyword,
          points: PENALTIES.ORDER_FIXED_INSERT,
          description: `순서고정 키워드 '${kw.keyword}' 사이에 다른 토큰 삽입됨`,
          recommendation: `'${kw.keyword}' 사이에 다른 키워드가 삽입됨. 제거하여 나란히 배치 필요.`,
        });
      }
    }
  }

  return penalties;
}

/** [C-01] 조합형 공통 요소 반복 — 공통 부분이 2회 이상 등장하면 감점 */
export function checkCompositeRepeat(
  tokens: string[],
  keywordDb: KeywordMaster[]
): PenaltyItem[] {
  const penalties: PenaltyItem[] = [];
  const compositeKeywords = keywordDb.filter((kw) => kw.keywordType === 'composite');
  const checkedParts = new Set<string>();

  for (const kw of compositeKeywords) {
    const kwTokens = tokenize(kw.keyword);

    for (const part of kwTokens) {
      const partLower = part.toLowerCase();

      if (checkedParts.has(partLower)) continue;
      checkedParts.add(partLower);

      const occurrences = tokens.filter(
        (t) => t.toLowerCase() === partLower
      ).length;

      if (occurrences >= 2) {
        penalties.push({
          ruleId: 'C-01',
          type: 'composite_repeat',
          keyword: part,
          points: PENALTIES.COMPOSITE_REPEAT,
          description: `조합형 공통 요소 '${part}'가 ${occurrences}회 반복됨`,
          recommendation: `'${part}' 중복 기재됨. 1회만 기재하고 조합 노출 활용 권장. ${part.length}자 절약 가능.`,
        });
      }
    }
  }

  return penalties;
}

// ============================================
// 가점 체커
// ============================================

/** 조합형 키워드 공간 절약 — 공통 요소 1회로 N개 노출 시 +3 x (N-1) */
export function checkCompositeSpaceSaving(
  tokens: string[],
  keywordDb: KeywordMaster[]
): BonusItem[] {
  const bonuses: BonusItem[] = [];
  const compositeKeywords = keywordDb.filter((kw) => kw.keywordType === 'composite');
  const commonPartMap = new Map<string, string[]>();

  // 공통 부분별로 조합형 키워드 그룹화
  for (const kw of compositeKeywords) {
    const kwTokens = tokenize(kw.keyword);
    for (const part of kwTokens) {
      const partLower = part.toLowerCase();
      if (!commonPartMap.has(partLower)) {
        commonPartMap.set(partLower, []);
      }
      commonPartMap.get(partLower)!.push(kw.keyword);
    }
  }

  // 공통 부분이 상품명에 1회만 등장하면서 N개 키워드에 기여하면 가점
  for (const [part, keywords] of commonPartMap) {
    const occurrences = tokens.filter((t) => t.toLowerCase() === part).length;
    const exposedCount = keywords.filter((kwStr) => {
      const kwTokens = tokenize(kwStr);
      return kwTokens.every((t) =>
        tokens.some((nt) => nt.toLowerCase() === t.toLowerCase())
      );
    }).length;

    if (occurrences === 1 && exposedCount > 1) {
      const extraKeywords = exposedCount - 1;
      const bonusPoints = BONUSES.COMPOSITE_SPACE_SAVING_PER_EXTRA * extraKeywords;

      bonuses.push({
        type: 'composite_space_saving',
        keyword: part,
        points: bonusPoints,
        description: `공통 요소 '${part}' 1회 기재로 ${exposedCount}개 키워드 노출 (+${bonusPoints}점)`,
      });
    }
  }

  return bonuses;
}

/** 유효 키워드 밀도 확인 — 밀도 >= KEYWORD_DENSITY_THRESHOLD이면 +10점 */
export function checkKeywordDensity(
  tokens: string[],
  validKeywords: string[]
): BonusItem[] {
  const bonuses: BonusItem[] = [];

  if (tokens.length === 0) return bonuses;

  const validTokenCount = tokens.filter((t) =>
    validKeywords.some((vk) => vk.toLowerCase() === t.toLowerCase())
  ).length;
  const density = validTokenCount / tokens.length;

  if (density >= BONUSES.KEYWORD_DENSITY_THRESHOLD) {
    bonuses.push({
      type: 'high_keyword_density',
      keyword: `밀도 ${(density * 100).toFixed(1)}%`,
      points: BONUSES.HIGH_KEYWORD_DENSITY,
      description: `유효 키워드 밀도 ${(density * 100).toFixed(1)}% (기준: ${BONUSES.KEYWORD_DENSITY_THRESHOLD * 100}% 이상)`,
    });
  }

  return bonuses;
}

/** 일체형 키워드 정확 기재 — 붙여쓰기 형태로 존재하면 +2점/건 */
export function checkIntegralCorrect(
  productName: string,
  keywordDb: KeywordMaster[]
): BonusItem[] {
  const bonuses: BonusItem[] = [];
  const integralKeywords = keywordDb.filter((kw) => kw.keywordType === 'integral');
  const nameLower = productName.toLowerCase();

  for (const kw of integralKeywords) {
    const joined = joinKeyword(kw.keyword).toLowerCase();

    if (nameLower.includes(joined)) {
      bonuses.push({
        type: 'integral_correct',
        keyword: kw.keyword,
        points: BONUSES.INTEGRAL_CORRECT_PER,
        description: `일체형 키워드 '${kw.keyword}' 정확 기재됨`,
      });
    }
  }

  return bonuses;
}

// ============================================
// 등급 판정
// ============================================

/** 점수 기반 등급 판정: S(95+), A(85-94), B(70-84), C(60-69), D(59-) */
export function determineGrade(score: number): ScoreGrade {
  if (score >= GRADE_THRESHOLDS.S) return 'S';
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  return 'D';
}

// ============================================
// 헬퍼
// ============================================

/** synonymGroupId 기준으로 키워드 그룹화 */
function groupBySynonymId(keywordDb: KeywordMaster[]): Map<number, KeywordMaster[]> {
  const groups = new Map<number, KeywordMaster[]>();

  for (const kw of keywordDb) {
    if (kw.synonymGroupId == null) continue;
    if (!groups.has(kw.synonymGroupId)) {
      groups.set(kw.synonymGroupId, []);
    }
    groups.get(kw.synonymGroupId)!.push(kw);
  }

  return groups;
}

/** 순서고정 키워드 사이에 삽입된 토큰 찾기 */
function findInsertedTokens(nameTokens: string[], kwTokens: string[]): string[] {
  const inserted: string[] = [];
  const lowerKwTokens = kwTokens.map((t) => t.toLowerCase());
  const firstToken = lowerKwTokens[0];
  const lastToken = lowerKwTokens[lowerKwTokens.length - 1];
  if (!firstToken || !lastToken) return [];

  const firstIdx = nameTokens.findIndex((t) => t.toLowerCase() === firstToken);
  if (firstIdx === -1) return [];
  const lastIdx = nameTokens.findIndex(
    (t, idx) => idx > firstIdx && t.toLowerCase() === lastToken
  );
  if (lastIdx === -1) return [];

  for (let i = firstIdx + 1; i < lastIdx; i++) {
    const token = nameTokens[i];
    if (token && !lowerKwTokens.includes(token.toLowerCase())) {
      inserted.push(token);
    }
  }

  return inserted;
}

/** 상품명 토큰 중 유효 키워드(redundant 제외) 추출 */
function extractValidKeywordStrings(
  tokens: string[],
  keywordDb: KeywordMaster[]
): string[] {
  const dbKeywords = keywordDb
    .filter((kw) => kw.keywordType !== 'redundant')
    .map((kw) => kw.keyword.toLowerCase());

  return tokens.filter((t) => {
    const tokenLower = t.toLowerCase();
    return dbKeywords.some((dbKw) => dbKw.includes(tokenLower));
  });
}
