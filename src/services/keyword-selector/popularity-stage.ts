/**
 * @file popularity-stage.ts
 * @description 상품 인기도 단계 판단
 * @responsibilities
 * - 대표 키워드 순위 기반 단계 판단
 * - 단계별 허용 전략 반환
 */

import { PopularityStage } from '@/types/keyword.types';
import {
  POPULARITY_STAGE_CONFIG,
  KEYWORD_CANDIDATE_CONFIG,
} from '@/config/app-config';
import { logger } from '@/utils/logger';

/**
 * 단계별 전략
 */
export interface StageStrategy {
  stage: PopularityStage;
  allowedCompetitions: readonly ('LOW' | 'MEDIUM' | 'HIGH')[];
  maxSearchVolume: number;
  description: string;
}

/**
 * 대표 키워드 순위로 인기도 단계 판단
 * @param representativeRank 대표 키워드 순위 (null이면 순위권 밖)
 * @returns 인기도 단계
 */
export function determinePopularityStage(
  representativeRank: number | null
): PopularityStage {
  // 순위권 밖이면 극초반
  if (representativeRank === null) {
    return 'extreme_early';
  }

  const { STAGES } = POPULARITY_STAGE_CONFIG;

  // 100위 이내면 안정기
  if (representativeRank <= STAGES.STABLE.MAX_RANK) {
    return 'stable';
  }

  // 100~500위면 성장기
  if (representativeRank <= STAGES.GROWTH.MAX_RANK) {
    return 'growth';
  }

  // 500위 이상이면 극초반
  return 'extreme_early';
}

/**
 * 인기도 단계에 맞는 전략 반환
 * @param stage 인기도 단계
 * @returns 단계별 전략
 */
export function getStageStrategy(stage: PopularityStage): StageStrategy {
  const { COMPETITION_FILTER, SEARCH_VOLUME_LIMIT } = KEYWORD_CANDIDATE_CONFIG;

  switch (stage) {
    case 'extreme_early':
      return {
        stage,
        allowedCompetitions: COMPETITION_FILTER.EXTREME_EARLY,
        maxSearchVolume: SEARCH_VOLUME_LIMIT.EXTREME_EARLY,
        description: '극초반 단계: LOW 경쟁강도만, 검색량 1,000 이하',
      };

    case 'growth':
      return {
        stage,
        allowedCompetitions: COMPETITION_FILTER.GROWTH,
        maxSearchVolume: SEARCH_VOLUME_LIMIT.GROWTH,
        description: '성장기 단계: LOW/MEDIUM 경쟁강도, 검색량 5,000 이하',
      };

    case 'stable':
      return {
        stage,
        allowedCompetitions: COMPETITION_FILTER.STABLE,
        maxSearchVolume: SEARCH_VOLUME_LIMIT.STABLE,
        description: '안정기 단계: 전체 경쟁강도 허용, 검색량 제한 없음',
      };

    default:
      logger.warn('알 수 없는 인기도 단계, extreme_early로 fallback', { stage });
      return {
        stage: 'extreme_early',
        allowedCompetitions: COMPETITION_FILTER.EXTREME_EARLY,
        maxSearchVolume: SEARCH_VOLUME_LIMIT.EXTREME_EARLY,
        description: '극초반 단계 (fallback)',
      };
  }
}

/**
 * 상품 정보로 전체 전략 반환 (편의 함수)
 * @param representativeRank 대표 키워드 순위
 * @returns 단계별 전략
 */
export function getProductStrategy(
  representativeRank: number | null
): StageStrategy {
  const stage = determinePopularityStage(representativeRank);
  return getStageStrategy(stage);
}

/**
 * 단계 변경 감지
 * @param prevRank 이전 순위
 * @param currRank 현재 순위
 * @returns 단계 변경 여부 및 정보
 */
export function detectStageChange(
  prevRank: number | null,
  currRank: number | null
): {
  changed: boolean;
  prevStage: PopularityStage;
  currStage: PopularityStage;
  direction: 'upgrade' | 'downgrade' | 'none';
} {
  const prevStage = determinePopularityStage(prevRank);
  const currStage = determinePopularityStage(currRank);

  const stageOrder: Record<PopularityStage, number> = {
    extreme_early: 0,
    growth: 1,
    stable: 2,
  };

  const prevOrder = stageOrder[prevStage];
  const currOrder = stageOrder[currStage];

  let direction: 'upgrade' | 'downgrade' | 'none' = 'none';
  if (currOrder > prevOrder) direction = 'upgrade';
  else if (currOrder < prevOrder) direction = 'downgrade';

  return {
    changed: prevStage !== currStage,
    prevStage,
    currStage,
    direction,
  };
}
