/**
 * @file DailyTrendChart.tsx
 * @description 일일 매출/비용 트렌드 차트 (Recharts)
 */

'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyTrend } from '@/lib/queries/dashboard';
import { formatCurrency } from '@/lib/utils/formatters';

interface DailyTrendChartProps {
  data: DailyTrend[];
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">매출 / 광고비 트렌드</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-10 text-sm">
            데이터가 없습니다
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    dateLabel: d.date.slice(5), // MM-DD
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">매출 / 광고비 트렌드 (30일)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="dateLabel" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                name === 'totalSales' ? '매출' : '광고비',
              ]}
              labelFormatter={(label) => `날짜: ${label}`}
            />
            <Legend
              formatter={(value) => (value === 'totalSales' ? '매출' : '광고비')}
            />
            <Line
              type="monotone"
              dataKey="totalSales"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="totalCost"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
