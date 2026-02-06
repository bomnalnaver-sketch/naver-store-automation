/**
 * @file BarChartCard.tsx
 * @description 바 차트 카드 (TokenUsageChart 대체)
 */

'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

type YAxisFormat = 'man' | 'percent' | 'number';

const Y_AXIS_FORMATTERS: Record<YAxisFormat, (v: number) => string> = {
  man: (v) => `${(v / 10000).toFixed(0)}만`,
  percent: (v) => `${v}%`,
  number: (v) => v.toLocaleString(),
};

interface BarChartCardProps {
  title: string;
  data: Record<string, unknown>[];
  config: ChartConfig;
  xAxisKey: string;
  yAxisFormat?: YAxisFormat;
  className?: string;
}

export function BarChartCard({
  title,
  data,
  config,
  xAxisKey,
  yAxisFormat,
  className,
}: BarChartCardProps) {
  const dataKeys = Object.keys(config);

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-10 text-sm">
            데이터가 없습니다
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-0">
        <ChartContainer config={config} className="h-[280px] w-full">
          <BarChart data={data} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
              tickFormatter={yAxisFormat ? Y_AXIS_FORMATTERS[yAxisFormat] : undefined}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {dataKeys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`var(--color-${key})`}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
