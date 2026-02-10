/**
 * @file index.ts
 * @description 키워드 선정 모듈 통합 진입점
 * @responsibilities
 * - 인기도 단계 판단
 * - 단계별 필터링
 * - 점수화 및 선정
 */

import {
  DiscoveredKeyword,
  KeywordCandidate,
  SelectionResult,
  PopularityStage,
} from '@/types/keyword.types';
import {
  determinePopularityStage,
  getStageStrategy,
  getProductStrategy,
  StageStrategy,
} from './popularity-stage';
import { filterKeywords, filterCandidates } from './competition-filter';
import {
  scoreKeywords,
  sortByScore,
  selectTopKeywords,
  ScoredKeyword,
  logScoreAnalysis,
} from './candidate-scorer';
import { KEYWORD_CANDIDATE_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

// Re-export
export {
  determinePopularityStage,
  getStageStrategy,
  getProductStrategy,
  detectStageChange,
} from './popularity-stage';
export type { StageStrategy } from './popularity-stage';

export {
  filterKeywords,
  filterCandidates,
  filterByCompetition,
  filterBySearchVolume,
} from './competition-filter';
export type { FilterResult } from './competition-filter';

export {
  calculateTotalScore,
  scoreKeywords,
  sortByScore,
  selectTopKeywords,
  filterByMinScore,
  calculateScoreStats,
} from './candidate-scorer';
export type { ScoredKeyword } from './candidate-scorer';

/**
 * 키워드 선정 입력
 */
export interface SelectionInput {
  productId: number;
  representativeKeywordRank: number | null;
  discoveredKeywords: DiscoveredKeyword[];
  existingCandidates?: KeywordCandidate[];
  /** 이전에 테스트 실패/퇴역한 키워드 목록 */
  failedKeywords?: string[];
  maxSelect?: number;
}

/**
 * 키워드 선정 실행
 * 1. 인기도 단계 판단
 * 2. 단계에 맞는 필터링
 * 3. 점수화
 * 4. 상위 N개 선정
 */
export async function selectKeywords(
  input: SelectionInput
): Promise<SelectionResult> {
  const {
    productId,
    representativeKeywordRank,
    discoveredKeywords,
    existingCandidates = [],
    failedKeywords = [],
    maxSelect = KEYWORD_CANDIDATE_CONFIG.TEST.MAX_CONCURRENT,
  } = input;

  // 1. 인기도 단계 판단
  const popularityStage = determinePopularityStage(representativeKeywordRank);
  const strategy = getStageStrategy(popularityStage);

  logger.info('키워드 선정 시작', {
    productId,
    representativeRank: representativeKeywordRank,
    stage: popularityStage,
    discovered: discoveredKeywords.length,
    existingCandidates: existingCandidates.length,
  });

  // 2. 필터링
  const filterResult = filterKeywords(discoveredKeywords, strategy);

  logger.debug('필터링 결과', {
    passed: filterResult.passed.length,
    rejected: filterResult.rejected.length,
  });

  // 3. 점수화 (실패 키워드 감점 포함)
  const existingKeywordsSet = new Set(
    existingCandidates.map((c) => c.keyword.toLowerCase())
  );
  const failedKeywordsSet = new Set(
    failedKeywords.map((k) => k.toLowerCase())
  );
  const scoredKeywords = scoreKeywords(filterResult.passed, existingKeywordsSet, failedKeywordsSet);

  // 점수 분석 로깅
  logScoreAnalysis(scoredKeywords, '후보 키워드');

  // 4. 현재 테스트 중인 후보 수 확인
  const testingCount = existingCandidates.filter(
    (c) => c.status === 'testing'
  ).length;
  const availableSlots = Math.max(0, maxSelect - testingCount);

  logger.debug('테스트 슬롯 상태', {
    maxSelect,
    currentTesting: testingCount,
    availableSlots,
  });

  // 5. 상위 N개 선정
  const selectedKeywords = selectTopKeywords(scoredKeywords, availableSlots);

  // 6. 결과 생성
  const selectedCandidates = selectedKeywords.map((scored) => ({
    candidate: toKeywordCandidate(scored, productId),
    scoreDetails: scored.scoreDetails,
  }));

  // 선정되지 않은 키워드들 (점수 낮은 것 + 필터링된 것)
  const notSelectedScored = scoredKeywords.filter(
    (sk) =>
      !selectedKeywords.some(
        (sel) => sel.keyword.toLowerCase() === sk.keyword.toLowerCase()
      )
  );

  const rejectedCandidates = [
    // 점수가 낮아서 선정되지 않은 것
    ...notSelectedScored.map((sk) => ({
      candidate: toKeywordCandidate(sk, productId),
      reason: `점수 ${sk.scoreDetails.totalScore.toFixed(1)}점으로 상위 ${maxSelect}개에 미포함`,
    })),
    // 필터링에서 제외된 것
    ...filterResult.rejected.map((r) => ({
      candidate: toKeywordCandidateFromDiscovered(r.item, productId),
      reason: r.reason,
    })),
  ];

  const result: SelectionResult = {
    productId,
    popularityStage,
    selectedCandidates,
    rejectedCandidates,
  };

  logger.info('키워드 선정 완료', {
    productId,
    stage: popularityStage,
    selected: selectedCandidates.length,
    rejected: rejectedCandidates.length,
  });

  return result;
}

/**
 * ScoredKeyword를 KeywordCandidate로 변환
 */
function toKeywordCandidate(
  scored: ScoredKeyword,
  productId: number
): KeywordCandidate {
  return {
    id: 0, // DB 저장 시 생성됨
    productId,
    keywordId: null,
    keyword: scored.keyword,
    source: scored.source,
    discoveredAt: new Date(),
    status: 'candidate',
    approvalStatus: 'approved',
    approvalReason: null,
    approvalAt: null,
    filterReason: null,
    categoryMatchRatio: null,
    competitionIndex: scored.competitionIndex || null,
    monthlySearchVolume: scored.monthlySearchVolume || 0,
    testStartedAt: null,
    testEndedAt: null,
    testResult: null,
    bestRank: null,
    currentRank: null,
    daysInTop40: 0,
    consecutiveDaysInTop40: 0,
    contributionScore: 0,
    candidateScore: scored.scoreDetails.totalScore,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * DiscoveredKeyword를 KeywordCandidate로 변환
 */
function toKeywordCandidateFromDiscovered(
  discovered: DiscoveredKeyword,
  productId: number
): KeywordCandidate {
  return {
    id: 0,
    productId,
    keywordId: null,
    keyword: discovered.keyword,
    source: discovered.source,
    discoveredAt: new Date(),
    status: 'candidate',
    approvalStatus: 'approved',
    approvalReason: null,
    approvalAt: null,
    filterReason: null,
    categoryMatchRatio: null,
    competitionIndex: discovered.competitionIndex || null,
    monthlySearchVolume: discovered.monthlySearchVolume || 0,
    testStartedAt: null,
    testEndedAt: null,
    testResult: null,
    bestRank: null,
    currentRank: null,
    daysInTop40: 0,
    consecutiveDaysInTop40: 0,
    contributionScore: 0,
    candidateScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * 기존 후보 재평가
 * 인기도 단계 변경 시 기존 후보들이 여전히 적합한지 확인
 */
export function reevaluateCandidates(
  candidates: KeywordCandidate[],
  newStage: PopularityStage
): {
  stillValid: KeywordCandidate[];
  noLongerValid: Array<{ candidate: KeywordCandidate; reason: string }>;
} {
  const strategy = getStageStrategy(newStage);
  const result = filterCandidates(candidates, strategy);

  return {
    stillValid: result.passed,
    noLongerValid: result.rejected.map((r) => ({
      candidate: r.item,
      reason: r.reason,
    })),
  };
}
