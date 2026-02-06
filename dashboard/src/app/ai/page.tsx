/**
 * @file page.tsx
 * @description AI 분석 페이지
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TokenUsageChart } from '@/components/ai/TokenUsageChart';
import { fetchAiDecisions, fetchTokenUsage } from '@/lib/queries/ai-decisions';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import './page.css';

const DECISION_TYPE_LABELS: Record<string, string> = {
  keyword_evaluation: '키워드 평가',
  keyword_discovery: '키워드 발굴',
  product_optimization: '상품 최적화',
};

export default async function AiPage() {
  const [decisions, tokenUsage] = await Promise.all([
    fetchAiDecisions(),
    fetchTokenUsage(),
  ]);

  return (
    <div className="ai-page">
      <h1 className="ai-title">AI 분석</h1>

      <TokenUsageChart data={tokenUsage} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 의사결정 이력 ({decisions.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>유형</TableHead>
                <TableHead>모델</TableHead>
                <TableHead className="text-right">토큰</TableHead>
                <TableHead className="text-right">실행시간</TableHead>
                <TableHead>시간</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    AI 의사결정 기록이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                decisions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {DECISION_TYPE_LABELS[d.decision_type] ?? d.decision_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.model ?? '-'}</TableCell>
                    <TableCell className="text-right text-sm">{formatNumber(d.tokens_used)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {d.execution_time_ms ? `${(d.execution_time_ms / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(d.created_at)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/ai/${d.id}`} className="text-sm text-blue-600 hover:underline">
                        상세
                      </Link>
                    </TableCell>
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
