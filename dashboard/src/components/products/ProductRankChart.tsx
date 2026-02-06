/**
 * @file ProductRankChart.tsx
 * @description 상품 키워드 순위 트렌드 차트 (LineChartCard 래퍼)
 */

'use client';

import { useMemo } from 'react';
import { LineChartCard } from '@/components/charts/LineChartCard';
import { CHART_COLORS } from '@/lib/constants/colors';
import type { ChartConfig } from '@/components/ui/chart';

interface RankDataPoint {
  keyword: string;
  rank: number | null;
  checked_at: string;
}

interface ProductRankChartProps {
  data: RankDataPoint[];
}

export function ProductRankChart({ data }: ProductRankChartProps) {
  const { chartData, config } = useMemo(() => {
    if (data.length === 0) return { chartData: [], config: {} as ChartConfig };

    const keywords = [...new Set(data.map((d) => d.keyword))].slice(0, 5);
    const dateMap = new Map<string, Record<string, number | null>>();

    for (const d of data) {
      const dateKey = d.checked_at.slice(0, 10);
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
      dateMap.get(dateKey)![d.keyword] = d.rank;
    }

    const sorted = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, ranks]) => ({ dateLabel: date.slice(5), ...ranks }));

    const cfg: ChartConfig = {};
    keywords.forEach((kw, i) => {
      cfg[kw] = { label: kw, color: CHART_COLORS[i % CHART_COLORS.length] };
    });

    return { chartData: sorted, config: cfg };
  }, [data]);

  return (
    <LineChartCard
      title="순위 트렌드 (30일)"
      data={chartData}
      config={config}
      xAxisKey="dateLabel"
      yAxisReversed
      yAxisFormat="rank"
    />
  );
}
