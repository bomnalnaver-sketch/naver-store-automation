/**
 * @file page.tsx
 * @description 상품별 키워드 개선 상세 페이지
 * @responsibilities
 * - 현재 상품명 표시
 * - 4개 탭: 후보관리, 순서관리, 키워드변경 추천, 최종 상품명 제작
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { fetchProductById } from '@/lib/queries/products';
import {
  fetchMappedKeywordsWithMetrics,
  fetchCandidatesForImprove,
} from '@/lib/queries/keyword-improve';
import { formatNumber, formatRank } from '@/lib/utils/formatters';
import { KeywordImproveTabs } from '@/components/keyword-improve/KeywordImproveTabs';
import { MetricsEnrichButton } from '@/components/keyword-improve/MetricsEnrichButton';
import { ClassifyButton } from '@/components/keyword-improve/ClassifyButton';
import './page.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KeywordImproveDetailPage({ params }: PageProps) {
  const { id } = await params;
  const productId = Number(id);

  if (isNaN(productId)) notFound();

  const product = await fetchProductById(productId);
  if (!product) notFound();

  const [mappedKeywords, candidates] = await Promise.all([
    fetchMappedKeywordsWithMetrics(productId),
    fetchCandidatesForImprove(productId),
  ]);

  const charCount = product.product_name.length;
  const avgScore = mappedKeywords.length > 0
    ? mappedKeywords.reduce((s, k) => s + k.priorityScore, 0) / mappedKeywords.length
    : 0;

  return (
    <div className="ki-detail-page">
      <PageHeader
        title="키워드 개선"
        description={product.product_name}
      />

      <div className="ki-back-bar">
        <Link href="/keyword-improve">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            상품 목록으로
          </Button>
        </Link>
      </div>

      {/* 현재 상품명 표시 */}
      <Card className="ki-current-name-card">
        <div className="ki-current-name-header">
          <span className="ki-current-name-label">현재 상품명</span>
          <span className={`ki-char-count ${charCount > 90 ? 'ki-char-count-warn' : ''}`}>
            {charCount}/100자
          </span>
        </div>
        <p className="ki-current-name-text">{product.product_name}</p>
      </Card>

      {/* 액션 바 */}
      <div className="ki-enrich-bar">
        <ClassifyButton />
        <MetricsEnrichButton />
      </div>

      {/* 요약 통계 */}
      <div className="ki-detail-stats">
        <Card className="ki-detail-stat">
          <CardContent className="p-0">
            <p className="ki-detail-stat-value">{mappedKeywords.length}</p>
            <p className="ki-detail-stat-label">매핑 키워드</p>
          </CardContent>
        </Card>
        <Card className="ki-detail-stat">
          <CardContent className="p-0">
            <p className="ki-detail-stat-value">{candidates.length}</p>
            <p className="ki-detail-stat-label">후보 키워드</p>
          </CardContent>
        </Card>
        <Card className="ki-detail-stat">
          <CardContent className="p-0">
            <p className="ki-detail-stat-value">{avgScore.toFixed(1)}</p>
            <p className="ki-detail-stat-label">평균 우선순위</p>
          </CardContent>
        </Card>
        <Card className="ki-detail-stat">
          <CardContent className="p-0">
            <p className="ki-detail-stat-value">
              {formatRank(product.representative_keyword_rank)}
            </p>
            <p className="ki-detail-stat-label">대표 키워드 순위</p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 영역 */}
      <KeywordImproveTabs
        productId={productId}
        productName={product.product_name}
        mappedKeywords={mappedKeywords}
        candidates={candidates}
      />
    </div>
  );
}
