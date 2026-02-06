/**
 * @file page.tsx
 * @description 키워드 분석 페이지
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { KeywordsTableClient } from '@/components/keywords/KeywordsTableClient';
import { DonutChartCard } from '@/components/charts/DonutChartCard';
import { fetchKeywords, fetchKeywordTypeCounts, fetchColorCounts } from '@/lib/queries/keywords';
import { formatNumber } from '@/lib/utils/formatters';
import { KEYWORD_TYPE_LABELS, KEYWORD_TYPE_COLORS, COLOR_CLASS_LABELS } from '@/lib/constants/colors';
import type { KeywordType, ColorClass } from '@/lib/supabase/types';
import type { ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import './page.css';

const colorChartConfig: ChartConfig = {
  yellow: { label: '상품명전용', color: 'oklch(0.80 0.18 90)' },
  gray: { label: '카테고리', color: 'oklch(0.60 0.02 264)' },
  green: { label: '속성', color: 'oklch(0.65 0.18 145)' },
  blue: { label: '태그', color: 'oklch(0.60 0.18 240)' },
  orange: { label: '혼합(AI)', color: 'oklch(0.70 0.18 50)' },
};

export default async function KeywordsPage() {
  const [keywords, typeCounts, colorCounts] = await Promise.all([
    fetchKeywords(),
    fetchKeywordTypeCounts(),
    fetchColorCounts(),
  ]);

  const typeEntries = Object.entries(typeCounts) as [KeywordType, number][];
  const colorData = (Object.entries(colorCounts) as [ColorClass, number][])
    .map(([name, value]) => ({
      name,
      value,
      fill: colorChartConfig[name]?.color,
    }));

  return (
    <div className="keywords-page">
      <PageHeader
        title="키워드 분석"
        description="키워드 유형 및 색깔 분류 현황을 확인합니다"
      />

      <div className="keywords-type-grid">
        {typeEntries.map(([type, count]) => (
          <Card key={type}>
            <CardContent className="p-4">
              <Badge variant="secondary" className={cn('text-xs mb-2', KEYWORD_TYPE_COLORS[type])}>
                {KEYWORD_TYPE_LABELS[type]}
              </Badge>
              <p className="text-2xl font-bold">{formatNumber(count)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DonutChartCard
        title="색깔 분류 분포"
        data={colorData}
        config={colorChartConfig}
      />

      <Card>
        <CardContent className="pt-6">
          <KeywordsTableClient data={keywords} />
        </CardContent>
      </Card>
    </div>
  );
}
