/**
 * @file RankTrendChart.tsx
 * @description 키워드별 순위 트렌드 차트 (역Y축)
 */

'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS } from '@/lib/constants/colors';

interface RankDataPoint {
  keyword: string;
  rank: number | null;
  checked_at: string;
}

interface RankTrendChartProps {
  data: RankDataPoint[];
}

export function RankTrendChart({ data }: RankTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">순위 트렌드 (30일)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-10 text-sm">순위 데이터가 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  // 날짜별 × 키워드별 피벗
  const keywords = [...new Set(data.map((d) => d.keyword))];
  const dateMap = new Map<string, Record<string, number | null>>();

  for (const d of data) {
    const dateKey = d.checked_at.slice(0, 10);
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
    dateMap.get(dateKey)![d.keyword] = d.rank;
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ranks]) => ({ date: date.slice(5), ...ranks }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">순위 트렌드 (30일)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis reversed domain={[1, 'auto']} fontSize={12} />
            <Tooltip />
            <Legend />
            {keywords.slice(0, 5).map((kw, i) => (
              <Line
                key={kw}
                type="monotone"
                dataKey={kw}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
