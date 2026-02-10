/**
 * @file candidate-scorer.ts
 * @description 키워드 후보 점수화
 * @responsibilities
 * - 검색량 점수 계산
 * - 경쟁강도 점수 계산
 * - 소스 점수 계산
 * - 신규 보너스 점수 계산
 * - 총점 계산 및 정렬
 */

import {
  DiscoveredKeyword,
  KeywordSource,
  CandidateScoreDetails,
} from '@/types/keyword.types';
import { KEYWORD_CANDIDATE_CONFIG } from '@/config/app-config';
import { logger } from '@/utils/logger';

const { SCORING } = KEYWORD_CANDIDATE_CONFIG;

/**
 * 점수가 계산된 키워드
 */
export interface ScoredKeyword extends DiscoveredKeyword {
  scoreDetails: CandidateScoreDetails;
}

/**
 * 검색량 점수 계산 (0~30점)
 * 적정 범위(100~3000)에 가까울수록 높은 점수
 */
export function calculateSearchVolumeScore(
  monthlySearchVolume: number | undefined
): number {
  const { MAX_SCORE, OPTIMAL_RANGE } = SCORING.SEARCH_VOLUME;

  // 검색량 정보 없으면 중간 점수
  if (monthlySearchVolume === undefined) {
    return MAX_SCORE * 0.5;
  }

  const volume = monthlySearchVolume;

  // 적정 범위 내면 최고 점수
  if (volume >= OPTIMAL_RANGE.MIN && volume <= OPTIMAL_RANGE.MAX) {
    return MAX_SCORE;
  }

  // 적정 범위 미만
  if (volume < OPTIMAL_RANGE.MIN) {
    // 검색량이 너무 적으면 점수 감소
    const ratio = volume / OPTIMAL_RANGE.MIN;
    return Math.max(0, MAX_SCORE * ratio * 0.8);
  }

  // 적정 범위 초과
  // 검색량이 많으면 점차 점수 감소 (경쟁이 치열해짐)
  const excessRatio = OPTIMAL_RANGE.MAX / volume;
  return Math.max(0, MAX_SCORE * excessRatio);
}

/**
 * 경쟁강도 점수 계산 (0~40점)
 * LOW=40, MEDIUM=25, HIGH=10
 */
export function calculateCompetitionScore(
  competitionIndex: 'LOW' | 'MEDIUM' | 'HIGH' | undefined
): number {
  const { SCORES } = SCORING.COMPETITION;

  if (!competitionIndex) {
    // 경쟁강도 정보 없으면 MEDIUM 점수
    return SCORES.MEDIUM;
  }

  return SCORES[competitionIndex] || SCORES.MEDIUM;
}

/**
 * 소스 점수 계산 (0~20점)
 * competitor=20, search_ad=15, product_name=10
 */
export function calculateSourceScore(source: KeywordSource): number {
  const { SCORES } = SCORING.SOURCE;
  return SCORES[source] || 10;
}

/**
 * 신규 보너스 점수 (0~10점)
 * 처음 발굴된 키워드에게 보너스
 */
export function calculateNoveltyScore(isNew: boolean): number {
  return isNew ? SCORING.NOVELTY.MAX_SCORE : 0;
}

/**
 * 실패 키워드 감점 (-20점)
 * 이전에 테스트해서 실패한 키워드는 재시도 페널티 적용
 */
export function calculateFailedPenalty(isFailed: boolean): number {
  if (!isFailed) return 0;
  return SCORING.NOVELTY.FAILED_PENALTY;
}

/**
 * 키워드 총점 계산
 */
export function calculateTotalScore(
  keyword: DiscoveredKeyword,
  isNew: boolean = true,
  isFailed: boolean = false
): CandidateScoreDetails {
  const searchVolumeScore = calculateSearchVolumeScore(
    keyword.monthlySearchVolume
  );
  const competitionScore = calculateCompetitionScore(keyword.competitionIndex);
  const sourceScore = calculateSourceScore(keyword.source);
  const noveltyScore = calculateNoveltyScore(isNew);
  const failedPenalty = calculateFailedPenalty(isFailed);

  // 실패 키워드는 감점 적용 (최소 0점)
  const totalScore = Math.max(
    0,
    searchVolumeScore + competitionScore + sourceScore + noveltyScore + failedPenalty
  );

  return {
    searchVolumeScore,
    competitionScore,
    sourceScore,
    noveltyScore,
    totalScore,
  };
}

/**
 * 발굴된 키워드 목록에 점수 부여
 * @param failedKeywords 이전에 테스트 실패한 키워드 Set (정규화된)
 */
export function scoreKeywords(
  keywords: DiscoveredKeyword[],
  existingKeywords: Set<string> = new Set(),
  failedKeywords: Set<string> = new Set()
): ScoredKeyword[] {
  return keywords.map((keyword) => {
    const lower = keyword.keyword.toLowerCase();
    const normalized = keyword.keyword.replace(/\s+/g, '').toLowerCase();
    const isNew = !existingKeywords.has(lower);
    const isFailed = failedKeywords.has(lower) || failedKeywords.has(normalized);
    const scoreDetails = calculateTotalScore(keyword, isNew, isFailed);

    return {
      ...keyword,
      scoreDetails,
    };
  });
}

/**
 * 점수 순으로 정렬
 */
export function sortByScore(keywords: ScoredKeyword[]): ScoredKeyword[] {
  return [...keywords].sort(
    (a, b) => b.scoreDetails.totalScore - a.scoreDetails.totalScore
  );
}

/**
 * 상위 N개 키워드 선택
 */
export function selectTopKeywords(
  keywords: ScoredKeyword[],
  count: number
): ScoredKeyword[] {
  const sorted = sortByScore(keywords);
  return sorted.slice(0, count);
}

/**
 * 점수 통계 계산
 */
export function calculateScoreStats(keywords: ScoredKeyword[]): {
  count: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  distribution: {
    excellent: number; // 80+
    good: number; // 60-79
    average: number; // 40-59
    poor: number; // <40
  };
} {
  if (keywords.length === 0) {
    return {
      count: 0,
      avgScore: 0,
      maxScore: 0,
      minScore: 0,
      distribution: { excellent: 0, good: 0, average: 0, poor: 0 },
    };
  }

  const scores = keywords.map((k) => k.scoreDetails.totalScore);
  const sum = scores.reduce((a, b) => a + b, 0);

  const distribution = {
    excellent: scores.filter((s) => s >= 80).length,
    good: scores.filter((s) => s >= 60 && s < 80).length,
    average: scores.filter((s) => s >= 40 && s < 60).length,
    poor: scores.filter((s) => s < 40).length,
  };

  return {
    count: keywords.length,
    avgScore: sum / keywords.length,
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
    distribution,
  };
}

/**
 * 점수 임계값으로 필터링
 */
export function filterByMinScore(
  keywords: ScoredKeyword[],
  minScore: number
): ScoredKeyword[] {
  return keywords.filter((k) => k.scoreDetails.totalScore >= minScore);
}

/**
 * 점수 분석 로깅
 */
export function logScoreAnalysis(
  keywords: ScoredKeyword[],
  context: string
): void {
  const stats = calculateScoreStats(keywords);

  logger.info(`${context} 점수 분석`, {
    count: stats.count,
    avgScore: stats.avgScore.toFixed(1),
    maxScore: stats.maxScore,
    minScore: stats.minScore,
    distribution: stats.distribution,
  });
}
