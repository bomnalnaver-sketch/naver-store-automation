/**
 * @file page.tsx
 * @description 키워드 후보 승인 관리 페이지
 * - productId 없음: 상품 리스트 (상품별 후보 개수)
 * - productId 있음: 해당 상품의 후보 키워드 테이블
 */

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { CandidatesTableClient } from '@/components/candidates/CandidatesTableClient';
import { DiscoverButton } from '@/components/candidates/DiscoverButton';
import { ProductList } from '@/components/candidates/ProductList';
import {
  getCandidatesWithFilter,
  getCandidateStats,
  getProductCandidateSummaries,
} from '@/lib/queries/candidates';
import { fetchProductById } from '@/lib/queries/products';
import { formatNumber } from '@/lib/utils/formatters';
import './page.css';

interface CandidatesPageProps {
  searchParams: Promise<{ productId?: string }>;
}

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const params = await searchParams;
  const productId = params.productId ? parseInt(params.productId, 10) : undefined;

  // 상품 미선택: 상품 리스트 뷰
  if (!productId) {
    return <ProductListView />;
  }

  // 상품 선택됨: 후보 키워드 뷰
  return <CandidateDetailView productId={productId} />;
}

// ============================================
// 상품 리스트 뷰
// ============================================

async function ProductListView() {
  const [summaries, globalStats] = await Promise.all([
    getProductCandidateSummaries(),
    getCandidateStats(),
  ]);

  return (
    <div className="candidates-page">
      <PageHeader
        title="키워드 후보 관리"
        description="상품을 선택하여 AI가 발굴한 키워드 후보를 관리합니다"
      >
        <DiscoverButton />
      </PageHeader>

      <div className="candidates-stats-grid">
        <Card className="candidates-stat-card candidates-stat-pending">
          <CardContent className="p-0">
            <p className="candidates-stat-value">{formatNumber(globalStats.totalPending)}</p>
            <p className="candidates-stat-label">전체 승인 대기</p>
          </CardContent>
        </Card>
        <Card className="candidates-stat-card candidates-stat-approved">
          <CardContent className="p-0">
            <p className="candidates-stat-value">{formatNumber(globalStats.totalApproved)}</p>
            <p className="candidates-stat-label">전체 승인됨</p>
          </CardContent>
        </Card>
        <Card className="candidates-stat-card candidates-stat-rejected">
          <CardContent className="p-0">
            <p className="candidates-stat-value">{formatNumber(globalStats.totalRejected)}</p>
            <p className="candidates-stat-label">전체 거부됨</p>
          </CardContent>
        </Card>
        <Card className="candidates-stat-card">
          <CardContent className="p-0">
            <p className="candidates-stat-value">{summaries.length}</p>
            <p className="candidates-stat-label">후보 보유 상품</p>
          </CardContent>
        </Card>
      </div>

      <Card className="candidates-table-card">
        <div className="candidates-table-header">
          <h2 className="candidates-table-title">
            상품 목록
          </h2>
        </div>
        <div className="candidates-table-content">
          <ProductList products={summaries} />
        </div>
      </Card>
    </div>
  );
}

// ============================================
// 후보 키워드 상세 뷰
// ============================================

async function CandidateDetailView({ productId }: { productId: number }) {
  const [product, candidatesResult, stats] = await Promise.all([
    fetchProductById(productId),
    getCandidatesWithFilter(
      { approvalStatus: 'pending', productId },
      { page: 1, pageSize: 200 }
    ),
    getCandidateStats(productId),
  ]);

  const { data: candidates, total } = candidatesResult;
  const productName = product?.product_name ?? `상품 #${productId}`;

  return (
    <div className="candidates-page">
      <PageHeader
        title={productName}
        description="키워드 후보를 승인하거나 거부합니다"
      >
        <DiscoverButton />
      </PageHeader>

      <div className="candidates-back-bar">
        <Link href="/candidates">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            상품 목록으로
          </Button>
        </Link>
      </div>

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
              <p className="text-sm">키워드 발굴을 실행하면 후보가 생성됩니다.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
