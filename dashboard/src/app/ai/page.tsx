/**
 * @file page.tsx
 * @description AI 분석 페이지
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { BarChartCard } from '@/components/charts/BarChartCard';
import { AiTableClient } from '@/components/ai/AiTableClient';
import { fetchAiDecisions, fetchTokenUsage } from '@/lib/queries/ai-decisions';
import type { ChartConfig } from '@/components/ui/chart';
import './page.css';

const tokenChartConfig: ChartConfig = {
  tokens: { label: '토큰', color: 'var(--chart-3)' },
};

export default async function AiPage() {
  const [decisions, tokenUsage] = await Promise.all([
    fetchAiDecisions(),
    fetchTokenUsage(),
  ]);

  const tokenData = tokenUsage.map((d) => ({
    ...d,
    dateLabel: d.date.slice(5),
  }));

  return (
    <div className="ai-page">
      <PageHeader
        title="AI 분석"
        description="AI 의사결정 이력과 토큰 사용량을 확인합니다"
      />

      <BarChartCard
        title="토큰 사용량 (30일)"
        data={tokenData}
        config={tokenChartConfig}
        xAxisKey="dateLabel"
        yAxisFormat="number"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 의사결정 이력 ({decisions.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          <AiTableClient data={decisions} />
        </CardContent>
      </Card>
    </div>
  );
}
