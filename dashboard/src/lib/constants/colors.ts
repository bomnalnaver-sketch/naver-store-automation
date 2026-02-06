/**
 * @file colors.ts
 * @description 키워드 유형/색깔 관련 상수 (라벨, 색상 매핑)
 */

import type { KeywordType, ColorClass, RankAlertType, PopularityStage } from '@/lib/supabase/types';

/** 키워드 유형 한글 라벨 */
export const KEYWORD_TYPE_LABELS: Record<KeywordType, string> = {
  composite: '조합형',
  integral: '일체형',
  order_fixed: '순서고정',
  synonym: '동의어',
  redundant: '불필요',
};

/** 키워드 유형별 배지 색상 (Tailwind) */
export const KEYWORD_TYPE_COLORS: Record<KeywordType, string> = {
  composite: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  integral: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  order_fixed: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  synonym: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  redundant: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

/** 색깔 분류 한글 라벨 */
export const COLOR_CLASS_LABELS: Record<ColorClass, string> = {
  yellow: '상품명전용',
  gray: '카테고리',
  green: '속성',
  blue: '태그',
  orange: '혼합(AI)',
};

/** 색깔 분류별 배지 색상 */
export const COLOR_CLASS_COLORS: Record<ColorClass, string> = {
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

/** 색깔 분류 아이콘 (이모지) */
export const COLOR_CLASS_ICONS: Record<ColorClass, string> = {
  yellow: '\uD83D\uDFE1',
  gray: '\u26AA',
  green: '\uD83D\uDFE2',
  blue: '\uD83D\uDD35',
  orange: '\uD83D\uDFE0',
};

/** 순위 알림 유형 라벨 */
export const RANK_ALERT_LABELS: Record<RankAlertType, string> = {
  SURGE: '급상승',
  DROP: '급하락',
  ENTER: '순위 진입',
  EXIT: '순위 이탈',
};

/** 순위 알림 유형 색상 */
export const RANK_ALERT_COLORS: Record<RankAlertType, string> = {
  SURGE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  DROP: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  ENTER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  EXIT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

/** 인기도 단계 라벨 */
export const POPULARITY_STAGE_LABELS: Record<PopularityStage, string> = {
  extreme_early: '극초반',
  growth: '성장기',
  stable: '안정기',
};

/** 인기도 단계 색상 */
export const POPULARITY_STAGE_COLORS: Record<PopularityStage, string> = {
  extreme_early: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  growth: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  stable: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

/** 차트 색상 팔레트 (CSS 변수 기반) */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'oklch(0.60 0.18 200)',
  'oklch(0.70 0.18 130)',
  'oklch(0.65 0.22 340)',
];
