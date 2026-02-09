/**
 * @file page.tsx
 * @description 키워드 후보 승인 관리 페이지
 */

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { CandidatesTableClient } from '@/components/candidates/CandidatesTableClient';
import { getPendingApprovalCandidates, getCandidateStats } from '@/lib/queries/candidates';
import { formatNumber } from '@/lib/utils/formatters';
import './page.css';

export default async function CandidatesPage() {
  const [{ data: candidates, total }, stats] = await Promise.all([
    getPendingApprovalCandidates({ page: 1, pageSize: 50 }),
    getCandidateStats(),
  ]);

  return (
    <div className="candidates-page">
      <PageHeader
        title="키워드 후보 관리"
        description="AI가 발굴한 키워드 후보를 승인하거나 거부합니다"
      />

      <div className="candidates-stats-grid">
        <Card className="candidates-stat-card candidates-stat-pending">
          <CardContent className="p-0">
            <p className="candidates-stat-value">{formatNumber(stats.totalPending)}</p>
            <p className="candidates-stat-label">승인 대기</p>
          </CardContent>
        </Card>
        <Card className="candidates-stat-card candidates-stat-approved">
          <CardContent className="p-0">
            <p className="candidates-stat-value">{formatNumber(stats.totalApproved)}</p>
            <p className="candidates-stat-label">승인됨</p>
          </CardContent>
        </Card>
        <Card className="candidates-stat-card candidates-stat-rejected">
          <CardContent className="p-0">
            <p className="candidates-stat-value">{formatNumber(stats.totalRejected)}</p>
            <p className="candidates-stat-label">거부됨</p>
          </CardContent>
        </Card>
        <Card className="candidates-stat-card">
          <CardContent className="p-0">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">상품명:</span>{' '}
                <span className="font-medium">{stats.bySource.product_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">검색광고:</span>{' '}
                <span className="font-medium">{stats.bySource.search_ad}</span>
              </div>
              <div>
                <span className="text-muted-foreground">경쟁사:</span>{' '}
                <span className="font-medium">{stats.bySource.competitor}</span>
              </div>
            </div>
            <p className="candidates-stat-label mt-2">소스별 대기</p>
          </CardContent>
        </Card>
      </div>

      <Card className="candidates-table-card">
        <div className="candidates-table-header">
          <h2 className="candidates-table-title">
            승인 대기 후보 ({formatNumber(total)}개)
          </h2>
        </div>
        <div className="candidates-table-content">
          {candidates.length > 0 ? (
            <CandidatesTableClient data={candidates} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">승인 대기 중인 후보가 없습니다</p>
              <p className="text-sm">키워드 발굴 작업이 실행되면 여기에 후보가 표시됩니다.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
