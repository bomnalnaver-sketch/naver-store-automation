/**
 * @file chartConfig.ts
 * @description 공통 차트 설정 및 색상 매핑
 */

import type { ChartConfig } from '@/components/ui/chart';

/** 기본 차트 색상 배열 (CSS 변수 참조) */
export const DEFAULT_CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

/** 숫자 인덱스로 ChartConfig 생성 */
export function buildChartConfig(
  items: { key: string; label: string }[]
): ChartConfig {
  const config: ChartConfig = {};
  items.forEach((item, i) => {
    config[item.key] = {
      label: item.label,
      color: DEFAULT_CHART_COLORS[i % DEFAULT_CHART_COLORS.length],
    };
  });
  return config;
}
