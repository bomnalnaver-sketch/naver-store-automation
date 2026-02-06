/**
 * @file recommendation-engine.ts
 * @description 자동 개선 제안 생성 엔진
 * @responsibilities
 * - 감점 항목별 구체적 개선 텍스트 생성
 * - 점수 요약 텍스트 생성
 * - 우선순위별 개선 제안 정렬
 */

import type {
  PenaltyItem,
  OptimizationScoreResult,
  ScoreGrade,
  BonusItem,
} from '@/types/keyword.types';
import { logger } from '@/utils/logger';

// ============================================
// 상수
// ============================================

/** 등급별 평가 메시지 */
const GRADE_MESSAGES: Record<ScoreGrade, string> = {
  S: '매우 우수한 상품명입니다. 키워드 활용이 최적화되어 있습니다.',
  A: '우수한 상품명입니다. 소폭 개선 여지가 있습니다.',
  B: '양호한 상품명입니다. 개선하면 노출량 증가가 기대됩니다.',
  C: '개선이 필요한 상품명입니다. 키워드 활용에 문제가 있습니다.',
  D: '즉시 개선이 필요합니다. 상품명 키워드 전략을 전면 재검토하세요.',
};

/** 감점 유형별 우선순위 (낮을수록 높은 우선순위) */
const PENALTY_PRIORITY: Record<PenaltyItem['type'], number> = {
  integral_split: 1,
  order_fixed_wrong: 2,
  order_fixed_insert: 3,
  redundant_keyword: 4,
  synonym_duplicate: 5,
  composite_repeat: 6,
};

// ============================================
// 개선 제안 생성
// ============================================

/**
 * 감점 항목별 개선 텍스트 생성
 * 각 penalty의 recommendation 필드를 기반으로 구체적인 개선 텍스트를 생성
 * @param penalties 감점 항목 배열
 * @returns 우선순위 정렬된 개선 텍스트 배열
 */
export function generateRecommendations(penalties: PenaltyItem[]): string[] {
  if (penalties.length === 0) {
    return ['현재 상품명에서 감점 항목이 발견되지 않았습니다.'];
  }

  // 우선순위별 정렬 (감점이 큰 항목 우선)
  const sorted = [...penalties].sort((a, b) => {
    const priorityDiff = PENALTY_PRIORITY[a.type] - PENALTY_PRIORITY[b.type];
    if (priorityDiff !== 0) return priorityDiff;
    // 같은 우선순위면 감점이 큰 것 우선 (음수이므로 작은 값이 큰 감점)
    return a.points - b.points;
  });

  const recommendations: string[] = [];

  for (const penalty of sorted) {
    const text = formatRecommendationText(penalty);
    recommendations.push(text);
  }

  logger.debug('Recommendations generated', {
    count: recommendations.length,
  });

  return recommendations;
}

/**
 * 감점 항목 유형별 개선 텍스트 포맷팅
 * @param penalty 감점 항목
 * @returns 포맷팅된 개선 텍스트
 */
function formatRecommendationText(penalty: PenaltyItem): string {
  const { type, keyword, points } = penalty;
  const absPoints = Math.abs(points);

  switch (type) {
    case 'redundant_keyword':
      return `[${absPoints}점 감점] '${keyword}' 제거 권장. 제거 시 ${keyword.length}자 공간 확보 가능.`;

    case 'synonym_duplicate': {
      const keywords = keyword.split(', ');
      const keywordA = keywords[0] || keyword;
      const keywordB = keywords[1] || keyword;
      return `[${absPoints}점 감점] '${keywordA}'와 '${keywordB}'는 동의어. '${keywordB}' 제거 권장.`;
    }

    case 'integral_split':
      return `[${absPoints}점 감점] '${keyword}'는 일체형 키워드. 반드시 붙여서 기재. 현재 분리 기재로 노출 불가.`;

    case 'order_fixed_wrong':
      return `[${absPoints}점 감점] '${keyword}'는 순서고정 키워드. 올바른 순서로 수정 필요.`;

    case 'order_fixed_insert':
      return `[${absPoints}점 감점] '${keyword}' 사이에 다른 키워드가 삽입됨. 제거하여 나란히 배치 필요.`;

    case 'composite_repeat':
      return `[${absPoints}점 감점] '${keyword}' 중복 기재됨. 1회만 기재하고 조합 노출 활용 권장. ${keyword.length}자 절약 가능.`;

    default:
      return penalty.recommendation;
  }
}

// ============================================
// 점수 요약
// ============================================

/**
 * 점수 요약 텍스트 생성
 * @param score 최적화 점수 결과
 * @returns 요약 텍스트
 */
export function generateSummary(score: OptimizationScoreResult): string {
  const { finalScore, grade, penalties, bonuses, totalPenalty, totalBonus } = score;

  const gradeMessage = GRADE_MESSAGES[grade];
  const penaltySummary = buildPenaltySummary(penalties);
  const bonusSummary = buildBonusSummary(bonuses);

  const lines: string[] = [
    `[상품명 최적화 점수: ${finalScore}점 (${grade}등급)]`,
    gradeMessage,
    '',
    `기본 점수: ${score.baseScore}점`,
  ];

  if (totalBonus > 0) {
    lines.push(`가점 합계: +${totalBonus}점`);
  }

  if (totalPenalty < 0) {
    lines.push(`감점 합계: ${totalPenalty}점`);
  }

  if (penaltySummary) {
    lines.push('', '--- 감점 내역 ---', penaltySummary);
  }

  if (bonusSummary) {
    lines.push('', '--- 가점 내역 ---', bonusSummary);
  }

  return lines.join('\n');
}

/**
 * 감점 내역 요약 문자열 생성
 * @param penalties 감점 항목 배열
 * @returns 감점 내역 요약 문자열
 */
function buildPenaltySummary(penalties: PenaltyItem[]): string {
  if (penalties.length === 0) return '';

  return penalties
    .map((p) => `  ${p.ruleId}: ${p.description} (${p.points}점)`)
    .join('\n');
}

/**
 * 가점 내역 요약 문자열 생성
 * @param bonuses 가점 항목 배열
 * @returns 가점 내역 요약 문자열
 */
function buildBonusSummary(bonuses: BonusItem[]): string {
  if (bonuses.length === 0) return '';

  return bonuses
    .map((b) => `  ${b.type}: ${b.description} (+${b.points}점)`)
    .join('\n');
}
