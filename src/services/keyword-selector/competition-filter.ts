/**
 * @file competition-filter.ts
 * @description 경쟁강도 기반 키워드 필터링
 * @responsibilities
 * - 인기도 단계에 맞는 경쟁강도 필터링
 * - 검색량 범위 필터링
 * - 필터링 결과 및 사유 제공
 */

import {
  DiscoveredKeyword,
  KeywordCandidate,
} from '@/types/keyword.types';
import { StageStrategy } from './popularity-stage';
import { logger } from '@/utils/logger';

/**
 * 필터링 결과
 */
export interface FilterResult<T> {
  passed: T[];
  rejected: Array<{
    item: T;
    reason: string;
  }>;
}

/**
 * 경쟁강도로 발굴 키워드 필터링
 * @param keywords 발굴된 키워드 목록
 * @param strategy 단계별 전략
 * @returns 필터링 결과
 */
export function filterByCompetition(
  keywords: DiscoveredKeyword[],
  strategy: StageStrategy
): FilterResult<DiscoveredKeyword> {
  const passed: DiscoveredKeyword[] = [];
  const rejected: Array<{ item: DiscoveredKeyword; reason: string }> = [];

  for (const keyword of keywords) {
    // 경쟁강도 정보가 없으면 일단 통과 (나중에 조회 필요)
    if (!keyword.competitionIndex) {
      passed.push(keyword);
      continue;
    }

    // 허용된 경쟁강도인지 확인
    if (strategy.allowedCompetitions.includes(keyword.competitionIndex)) {
      passed.push(keyword);
    } else {
      rejected.push({
        item: keyword,
        reason: `경쟁강도 ${keyword.competitionIndex}는 ${strategy.stage} 단계에서 허용되지 않음 (허용: ${strategy.allowedCompetitions.join(', ')})`,
      });
    }
  }

  logger.debug('경쟁강도 필터링 완료', {
    stage: strategy.stage,
    total: keywords.length,
    passed: passed.length,
    rejected: rejected.length,
  });

  return { passed, rejected };
}

/**
 * 검색량으로 발굴 키워드 필터링
 * @param keywords 발굴된 키워드 목록
 * @param strategy 단계별 전략
 * @returns 필터링 결과
 */
export function filterBySearchVolume(
  keywords: DiscoveredKeyword[],
  strategy: StageStrategy
): FilterResult<DiscoveredKeyword> {
  const passed: DiscoveredKeyword[] = [];
  const rejected: Array<{ item: DiscoveredKeyword; reason: string }> = [];

  for (const keyword of keywords) {
    // 검색량 정보가 없으면 일단 통과 (나중에 조회 필요)
    if (keyword.monthlySearchVolume === undefined) {
      passed.push(keyword);
      continue;
    }

    // 검색량 상한 확인
    if (keyword.monthlySearchVolume <= strategy.maxSearchVolume) {
      passed.push(keyword);
    } else {
      rejected.push({
        item: keyword,
        reason: `검색량 ${keyword.monthlySearchVolume}가 ${strategy.stage} 단계 상한 ${strategy.maxSearchVolume} 초과`,
      });
    }
  }

  logger.debug('검색량 필터링 완료', {
    stage: strategy.stage,
    maxVolume: strategy.maxSearchVolume,
    total: keywords.length,
    passed: passed.length,
    rejected: rejected.length,
  });

  return { passed, rejected };
}

/**
 * 후보 키워드 경쟁강도 필터링
 */
export function filterCandidatesByCompetition(
  candidates: KeywordCandidate[],
  strategy: StageStrategy
): FilterResult<KeywordCandidate> {
  const passed: KeywordCandidate[] = [];
  const rejected: Array<{ item: KeywordCandidate; reason: string }> = [];

  for (const candidate of candidates) {
    if (!candidate.competitionIndex) {
      passed.push(candidate);
      continue;
    }

    if (strategy.allowedCompetitions.includes(candidate.competitionIndex)) {
      passed.push(candidate);
    } else {
      rejected.push({
        item: candidate,
        reason: `경쟁강도 ${candidate.competitionIndex}는 ${strategy.stage} 단계에서 허용되지 않음`,
      });
    }
  }

  return { passed, rejected };
}

/**
 * 후보 키워드 검색량 필터링
 */
export function filterCandidatesBySearchVolume(
  candidates: KeywordCandidate[],
  strategy: StageStrategy
): FilterResult<KeywordCandidate> {
  const passed: KeywordCandidate[] = [];
  const rejected: Array<{ item: KeywordCandidate; reason: string }> = [];

  for (const candidate of candidates) {
    if (candidate.monthlySearchVolume <= strategy.maxSearchVolume) {
      passed.push(candidate);
    } else {
      rejected.push({
        item: candidate,
        reason: `검색량 ${candidate.monthlySearchVolume}가 상한 ${strategy.maxSearchVolume} 초과`,
      });
    }
  }

  return { passed, rejected };
}

/**
 * 통합 필터링 (경쟁강도 + 검색량)
 * @param keywords 발굴된 키워드 목록
 * @param strategy 단계별 전략
 * @returns 필터링 결과
 */
export function filterKeywords(
  keywords: DiscoveredKeyword[],
  strategy: StageStrategy
): FilterResult<DiscoveredKeyword> {
  // 1단계: 경쟁강도 필터링
  const competitionResult = filterByCompetition(keywords, strategy);

  // 2단계: 검색량 필터링 (경쟁강도 통과한 것만)
  const volumeResult = filterBySearchVolume(competitionResult.passed, strategy);

  // 모든 거절 사유 합치기
  const allRejected = [
    ...competitionResult.rejected,
    ...volumeResult.rejected,
  ];

  logger.info('키워드 통합 필터링 완료', {
    stage: strategy.stage,
    input: keywords.length,
    afterCompetition: competitionResult.passed.length,
    afterVolume: volumeResult.passed.length,
    totalRejected: allRejected.length,
  });

  return {
    passed: volumeResult.passed,
    rejected: allRejected,
  };
}

/**
 * 후보 통합 필터링
 */
export function filterCandidates(
  candidates: KeywordCandidate[],
  strategy: StageStrategy
): FilterResult<KeywordCandidate> {
  const competitionResult = filterCandidatesByCompetition(candidates, strategy);
  const volumeResult = filterCandidatesBySearchVolume(
    competitionResult.passed,
    strategy
  );

  return {
    passed: volumeResult.passed,
    rejected: [...competitionResult.rejected, ...volumeResult.rejected],
  };
}
