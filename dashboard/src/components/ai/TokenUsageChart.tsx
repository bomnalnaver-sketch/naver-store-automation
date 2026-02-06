/**
 * @file TokenUsageChart.tsx
 * @description 토큰 사용량 바 차트
 */

'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/formatters';

interface TokenUsageChartProps {
  data: { date: string; tokens: number }[];
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">토큰 사용량 (30일)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-10 text-sm">데이터가 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  const formatted = data.map((d) => ({ ...d, dateLabel: d.date.slice(5) }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">토큰 사용량 (30일)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="dateLabel" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(value) => [formatNumber(Number(value)), '토큰']} />
            <Bar dataKey="tokens" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
