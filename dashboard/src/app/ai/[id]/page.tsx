/**
 * @file [id]/page.tsx
 * @description AI 의사결정 상세 페이지
 */

import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAiDecisionById, fetchAiDecisionResults } from '@/lib/queries/ai-decisions';
import { formatNumber, formatDateFull } from '@/lib/utils/formatters';
import './page.css';

export default async function AiDecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decision = await fetchAiDecisionById(Number(id));
  if (!decision) notFound();

  const results = await fetchAiDecisionResults(decision.id);

  return (
    <div className="ai-detail-page">
      <h1 className="ai-detail-title">AI 의사결정 #{decision.id}</h1>

      {/* 요약 정보 */}
      <Card>
        <CardHeader><CardTitle className="text-base">요약</CardTitle></CardHeader>
        <CardContent>
          <dl className="ai-detail-grid">
            <div><dt className="ai-detail-label">유형</dt><dd>{decision.decision_type}</dd></div>
            <div><dt className="ai-detail-label">모델</dt><dd>{decision.model ?? '-'}</dd></div>
            <div><dt className="ai-detail-label">토큰</dt><dd>{formatNumber(decision.tokens_used)}</dd></div>
            <div><dt className="ai-detail-label">실행시간</dt><dd>{decision.execution_time_ms ? `${decision.execution_time_ms}ms` : '-'}</dd></div>
            <div><dt className="ai-detail-label">일시</dt><dd>{formatDateFull(decision.created_at)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {/* 입력 데이터 */}
      <Card>
        <CardHeader><CardTitle className="text-base">입력 데이터</CardTitle></CardHeader>
        <CardContent>
          <pre className="ai-json-viewer">{JSON.stringify(decision.input_data, null, 2)}</pre>
        </CardContent>
      </Card>

      {/* AI 응답 */}
      <Card>
        <CardHeader><CardTitle className="text-base">AI 응답</CardTitle></CardHeader>
        <CardContent>
          <pre className="ai-json-viewer">{JSON.stringify(decision.ai_response, null, 2)}</pre>
        </CardContent>
      </Card>

      {/* 실행 결과 */}
      {results.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">실행 결과 ({results.length}건)</CardTitle></CardHeader>
          <CardContent>
            <div className="ai-results-list">
              {results.map((r) => (
                <div key={r.id} className="ai-result-item">
                  <div className="ai-result-header">
                    <span className="font-medium text-sm">{r.action_type}</span>
                    <Badge
                      variant={r.status === 'success' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {r.status}
                    </Badge>
                  </div>
                  {r.error_message && <p className="text-sm text-red-500 mt-1">{r.error_message}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
