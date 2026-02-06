/**
 * @file LineChartCard.tsx
 * @description 라인 차트 카드 (RankTrendChart 대체)
 */

'use client';

import {
  Line,
  LineChart,
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

type YAxisFormat = 'man' | 'percent' | 'number' | 'rank';

const Y_AXIS_FORMATTERS: Record<YAxisFormat, (v: number) => string> = {
  man: (v) => `${(v / 10000).toFixed(0)}만`,
  percent: (v) => `${v}%`,
  number: (v) => v.toLocaleString(),
  rank: (v) => `${v}위`,
};

interface LineChartCardProps {
  title: string;
  data: Record<string, unknown>[];
  config: ChartConfig;
  xAxisKey: string;
  yAxisReversed?: boolean;
  yAxisFormat?: YAxisFormat;
  className?: string;
}

export function LineChartCard({
  title,
  data,
  config,
  xAxisKey,
  yAxisReversed,
  yAxisFormat,
  className,
}: LineChartCardProps) {
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
          <LineChart data={data} margin={{ left: 12, right: 12 }}>
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
              reversed={yAxisReversed}
              tickFormatter={yAxisFormat ? Y_AXIS_FORMATTERS[yAxisFormat] : undefined}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {dataKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
