/**
 * @file page.tsx
 * @description 키워드 분석 페이지
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TypeBadge } from '@/components/shared/TypeBadge';
import { ColorBadge } from '@/components/shared/ColorBadge';
import { ColorDistributionChart } from '@/components/keywords/ColorDistributionChart';
import { fetchKeywords, fetchKeywordTypeCounts, fetchColorCounts } from '@/lib/queries/keywords';
import { formatNumber } from '@/lib/utils/formatters';
import { KEYWORD_TYPE_LABELS, KEYWORD_TYPE_COLORS } from '@/lib/constants/colors';
import type { KeywordType } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import './page.css';

export default async function KeywordsPage() {
  const [keywords, typeCounts, colorCounts] = await Promise.all([
    fetchKeywords(),
    fetchKeywordTypeCounts(),
    fetchColorCounts(),
  ]);

  const typeEntries = Object.entries(typeCounts) as [KeywordType, number][];

  return (
    <div className="keywords-page">
      <h1 className="keywords-title">키워드 분석</h1>

      {/* 유형별 통계 카드 */}
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

      {/* 색깔 분포 차트 */}
      <ColorDistributionChart data={colorCounts} />

      {/* 키워드 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">전체 키워드 ({keywords.length}개)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>키워드</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>색깔</TableHead>
                <TableHead className="text-right">월간 검색량</TableHead>
                <TableHead>경쟁지수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    등록된 키워드가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                keywords.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.keyword}</TableCell>
                    <TableCell><TypeBadge type={k.keyword_type} /></TableCell>
                    <TableCell><ColorBadge color={k.color_class} /></TableCell>
                    <TableCell className="text-right">{formatNumber(k.monthly_total_search)}</TableCell>
                    <TableCell className="text-sm">{k.competition_index ?? '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
