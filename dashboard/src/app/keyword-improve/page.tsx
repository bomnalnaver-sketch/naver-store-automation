/**
 * @file page.tsx
 * @description 키워드 개선 메인 페이지 - 상품 목록
 * @responsibilities
 * - 상품별 키워드 현황 표시
 * - 상품 선택 → 상세 페이지 이동
 */

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import {
  fetchProductsForKeywordImprove,
  type ProductKeywordSummary,
} from '@/lib/queries/keyword-improve';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import './page.css';

export default async function KeywordImprovePage() {
  const products = await fetchProductsForKeywordImprove();

  const totalKeywords = products.reduce((s, p) => s + p.mappedKeywordCount, 0);
  const totalCandidates = products.reduce((s, p) => s + p.candidateCount, 0);

  return (
    <div className="ki-page">
      <PageHeader
        title="키워드 개선"
        description="상품별 키워드 후보관리, 순서관리, 변경 추천, 상품명 제작을 관리합니다"
      />

      <div className="ki-stats-grid">
        <Card className="ki-stat-card">
          <CardContent className="p-0">
            <p className="ki-stat-value">{products.length}</p>
            <p className="ki-stat-label">관리 상품 수</p>
          </CardContent>
        </Card>
        <Card className="ki-stat-card">
          <CardContent className="p-0">
            <p className="ki-stat-value">{formatNumber(totalKeywords)}</p>
            <p className="ki-stat-label">전체 매핑 키워드</p>
          </CardContent>
        </Card>
        <Card className="ki-stat-card">
          <CardContent className="p-0">
            <p className="ki-stat-value">{formatNumber(totalCandidates)}</p>
            <p className="ki-stat-label">전체 후보 키워드</p>
          </CardContent>
        </Card>
      </div>

      <Card className="ki-table-card">
        <div className="ki-table-header">
          <h2 className="ki-table-title">상품 선택</h2>
        </div>
        <div className="ki-table-content">
          {products.length > 0 ? (
            <ProductList products={products} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">등록된 상품이 없습니다</p>
              <p className="text-sm">상품 관리에서 상품을 먼저 등록해주세요.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ProductList({ products }: { products: ProductKeywordSummary[] }) {
  return (
    <div className="ki-product-list">
      {products.map((product) => (
        <Link
          key={product.productId}
          href={`/keyword-improve/${product.productId}`}
          className="ki-product-item"
        >
          <div className="ki-product-info">
            <span className="ki-product-name">{product.productName}</span>
            <div className="ki-product-meta">
              {product.representativeKeyword && (
                <span>대표: {product.representativeKeyword}</span>
              )}
              {product.popularityStage && (
                <span>
                  단계: {product.popularityStage === 'extreme_early' ? '극초반' :
                    product.popularityStage === 'growth' ? '성장기' : '안정기'}
                </span>
              )}
              {product.lastOptimizedAt && (
                <span>최근 수정: {formatRelativeTime(product.lastOptimizedAt)}</span>
              )}
            </div>
          </div>
          <div className="ki-product-badges">
            <span className="ki-badge ki-badge-keyword">
              키워드 {product.mappedKeywordCount}
            </span>
            {product.candidateCount > 0 && (
              <span className="ki-badge ki-badge-candidate">
                후보 {product.candidateCount}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}
