/**
 * @file contribution-analyzer.ts
 * @description 키워드 인기도 기여도 분석
 * @responsibilities
 * - 키워드별 인기도 기여 점수 계산
 * - 검색량 × 순위 기반 기여도 산정
 * - 기여도 순위 제공
 */

import { KeywordCandidate } from '@/types/keyword.types';
import { KEYWORD_CANDIDATE_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

const { TOP_PAGE } = KEYWORD_CANDIDATE_CONFIG;

/**
 * 기여도 분석 결과
 */
export interface ContributionAnalysis {
  candidateId: number;
  keyword: string;
  rawScore: number;
  normalizedScore: number;
  rank: number;
  factors: ContributionFactors;
}

/**
 * 기여도 구성 요소
 */
export interface ContributionFactors {
  searchVolumeScore: number; // 검색량 점수 (0~40)
  rankScore: number; // 순위 점수 (0~40)
  stabilityScore: number; // 안정성 점수 (0~20)
}

/**
 * 기여도 계산 상수
 */
const CONTRIBUTION_WEIGHTS = {
  SEARCH_VOLUME: 0.4, // 40%
  RANK: 0.4, // 40%
  STABILITY: 0.2, // 20%
};

/**
 * 검색량 점수 계산 (0~40)
 * 검색량이 높을수록 높은 점수
 */
function calculateSearchVolumeScore(monthlySearchVolume: number): number {
  const maxScore = 40;

  // 검색량 구간별 점수
  if (monthlySearchVolume >= 10000) return maxScore;
  if (monthlySearchVolume >= 5000) return maxScore * 0.9;
  if (monthlySearchVolume >= 3000) return maxScore * 0.8;
  if (monthlySearchVolume >= 1000) return maxScore * 0.7;
  if (monthlySearchVolume >= 500) return maxScore * 0.5;
  if (monthlySearchVolume >= 100) return maxScore * 0.3;

  return maxScore * 0.1;
}

/**
 * 순위 점수 계산 (0~40)
 * 순위가 높을수록(숫자가 작을수록) 높은 점수
 */
function calculateRankScore(rank: number | null): number {
  const maxScore = 40;

  if (rank === null) return 0;

  // 1페이지(40위) 내 순위별 점수
  if (rank <= 10) return maxScore;
  if (rank <= 20) return maxScore * 0.85;
  if (rank <= 30) return maxScore * 0.7;
  if (rank <= TOP_PAGE.RANK_LIMIT) return maxScore * 0.5;

  // 1페이지 밖
  return 0;
}

/**
 * 안정성 점수 계산 (0~20)
 * 연속 진입 일수 기반
 */
function calculateStabilityScore(
  daysInTop40: number,
  consecutiveDaysInTop40: number
): number {
  const maxScore = 20;

  // 연속 진입 일수 비중 70%, 총 진입 일수 비중 30%
  const consecutiveScore = Math.min(consecutiveDaysInTop40 / 7, 1) * maxScore * 0.7;
  const totalScore = Math.min(daysInTop40 / 14, 1) * maxScore * 0.3;

  return consecutiveScore + totalScore;
}

/**
 * 단일 후보 기여도 계산
 */
export function calculateContribution(
  candidate: KeywordCandidate
): ContributionAnalysis {
  const factors: ContributionFactors = {
    searchVolumeScore: calculateSearchVolumeScore(candidate.monthlySearchVolume),
    rankScore: calculateRankScore(candidate.currentRank),
    stabilityScore: calculateStabilityScore(
      candidate.daysInTop40,
      candidate.consecutiveDaysInTop40
    ),
  };

  // 가중 합산
  const rawScore =
    factors.searchVolumeScore * CONTRIBUTION_WEIGHTS.SEARCH_VOLUME +
    factors.rankScore * CONTRIBUTION_WEIGHTS.RANK +
    factors.stabilityScore * CONTRIBUTION_WEIGHTS.STABILITY;

  return {
    candidateId: candidate.id,
    keyword: candidate.keyword,
    rawScore,
    normalizedScore: 0, // 나중에 정규화
    rank: 0, // 나중에 순위 매김
    factors,
  };
}

/**
 * 여러 후보의 기여도 분석 및 순위 매김
 */
export function analyzeContributions(
  candidates: KeywordCandidate[]
): ContributionAnalysis[] {
  // 활성 상태 후보만 분석
  const activeCandidates = candidates.filter(
    (c) => c.status === 'active' || c.status === 'warning'
  );

  if (activeCandidates.length === 0) {
    return [];
  }

  // 각 후보의 기여도 계산
  const analyses = activeCandidates.map(calculateContribution);

  // 점수 기준 정렬
  analyses.sort((a, b) => b.rawScore - a.rawScore);

  // 순위 및 정규화 점수 부여
  const maxScore = analyses[0]?.rawScore || 1;
  analyses.forEach((analysis, index) => {
    analysis.rank = index + 1;
    analysis.normalizedScore = (analysis.rawScore / maxScore) * 100;
  });

  logger.info('기여도 분석 완료', {
    total: activeCandidates.length,
    topKeyword: analyses[0]?.keyword,
    topScore: analyses[0]?.normalizedScore.toFixed(1),
  });

  return analyses;
}

/**
 * 기여도 상위 N개 추출
 */
export function getTopContributors(
  analyses: ContributionAnalysis[],
  count: number
): ContributionAnalysis[] {
  return analyses.slice(0, count);
}

/**
 * 기여도 하위 N개 추출 (퇴역 후보)
 */
export function getBottomContributors(
  analyses: ContributionAnalysis[],
  count: number
): ContributionAnalysis[] {
  return analyses.slice(-count);
}

/**
 * 기여도 점수를 후보에 반영
 */
export function applyContributionScores(
  candidates: KeywordCandidate[],
  analyses: ContributionAnalysis[]
): KeywordCandidate[] {
  const analysisMap = new Map(analyses.map((a) => [a.candidateId, a]));

  return candidates.map((candidate) => {
    const analysis = analysisMap.get(candidate.id);
    if (!analysis) return candidate;

    return {
      ...candidate,
      contributionScore: analysis.normalizedScore,
      updatedAt: new Date(),
    };
  });
}

/**
 * 기여도 통계 요약
 */
export function summarizeContributions(analyses: ContributionAnalysis[]): {
  total: number;
  avgScore: number;
  topKeywords: string[];
  bottomKeywords: string[];
} {
  if (analyses.length === 0) {
    return {
      total: 0,
      avgScore: 0,
      topKeywords: [],
      bottomKeywords: [],
    };
  }

  const totalScore = analyses.reduce((sum, a) => sum + a.normalizedScore, 0);

  return {
    total: analyses.length,
    avgScore: totalScore / analyses.length,
    topKeywords: analyses.slice(0, 3).map((a) => a.keyword),
    bottomKeywords: analyses.slice(-3).map((a) => a.keyword),
  };
}
