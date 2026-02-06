/**
 * @file page.tsx
 * @description 광고 성과 페이지
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchAdKeywordsWithStats, fetchAbTests } from '@/lib/queries/ads';
import { formatNumber, formatCurrency, formatPercent, getRoasColorClass } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import './page.css';

export default async function AdsPage() {
  const [adKeywords, abTests] = await Promise.all([
    fetchAdKeywordsWithStats(),
    fetchAbTests(),
  ]);

  return (
    <div className="ads-page">
      <h1 className="ads-title">광고 성과</h1>

      {/* 광고 키워드 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">광고 키워드 (최근 7일 집계)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>키워드</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">입찰가</TableHead>
                <TableHead className="text-right">노출</TableHead>
                <TableHead className="text-right">클릭</TableHead>
                <TableHead className="text-right">전환</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adKeywords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    광고 키워드가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                adKeywords.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.keyword}</TableCell>
                    <TableCell>
                      <Badge variant={k.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {k.status === 'active' ? '활성' : k.status === 'paused' ? '일시중지' : '제거'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(k.bid_amount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(k.total_impressions)}</TableCell>
                    <TableCell className="text-right">{formatNumber(k.total_clicks)}</TableCell>
                    <TableCell className="text-right">{formatNumber(k.total_conversions)}</TableCell>
                    <TableCell className={cn('text-right font-medium', getRoasColorClass(k.avg_roas))}>
                      {k.avg_roas != null ? formatPercent(k.avg_roas, 0) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* A/B 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A/B 테스트 현황</CardTitle>
        </CardHeader>
        <CardContent>
          {abTests.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">진행 중인 A/B 테스트가 없습니다</p>
          ) : (
            <div className="ab-test-grid">
              {abTests.map((test) => (
                <Card key={test.id}>
                  <CardContent className="p-4">
                    <div className="ab-test-header">
                      <span className="font-medium text-sm">{test.test_type}</span>
                      <Badge variant={test.status === 'running' ? 'default' : 'secondary'} className="text-xs">
                        {test.status === 'running' ? '진행중' : test.status === 'completed' ? '완료' : '중단'}
                      </Badge>
                    </div>
                    {test.winner && (
                      <p className="text-sm mt-2">
                        승자: <span className="font-bold">{test.winner.toUpperCase()}안</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
