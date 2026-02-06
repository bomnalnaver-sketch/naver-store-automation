/**
 * @file ColorDistributionChart.tsx
 * @description 색깔 분포 파이 차트
 */

'use client';

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColorClass } from '@/lib/supabase/types';
import { COLOR_CLASS_LABELS } from '@/lib/constants/colors';

const PIE_COLORS: Record<ColorClass, string> = {
  yellow: '#eab308',
  gray: '#9ca3af',
  green: '#22c55e',
  blue: '#3b82f6',
  orange: '#f97316',
};

interface ColorDistributionChartProps {
  data: Record<ColorClass, number>;
}

export function ColorDistributionChart({ data }: ColorDistributionChartProps) {
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: COLOR_CLASS_LABELS[key as ColorClass],
      value,
      color: PIE_COLORS[key as ColorClass],
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">색깔 분포</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-10 text-sm">데이터가 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">색깔 분포</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
