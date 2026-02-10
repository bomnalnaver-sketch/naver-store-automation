/**
 * @file [id]/page.tsx
 * @description 상품 상세 페이지
 */

import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { ProductKeywordsTableClient } from '@/components/products/ProductKeywordsTableClient';
import { ProductRankChart } from '@/components/products/ProductRankChart';
import { KeywordRanksTableClient } from '@/components/products/KeywordRanksTableClient';
import { fetchProductById, fetchProductKeywords, fetchProductRankings, fetchLatestKeywordRanks } from '@/lib/queries/products';
import { formatRank } from '@/lib/utils/formatters';
import { POPULARITY_STAGE_LABELS, POPULARITY_STAGE_COLORS } from '@/lib/constants/colors';
import type { PopularityStage } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import './page.css';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await fetchProductById(Number(id));
  if (!product) notFound();

  const [keywords, rankings, latestRanks] = await Promise.all([
    fetchProductKeywords(product.id),
    product.naver_shopping_product_id
      ? fetchProductRankings(product.naver_shopping_product_id)
      : Promise.resolve([]),
    product.naver_shopping_product_id
      ? fetchLatestKeywordRanks(product.naver_shopping_product_id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="product-detail-page">
      <PageHeader
        title={product.product_name}
        description={product.category_name ?? '카테고리 미지정'}
      />

      {/* 기본 정보 */}
      <Card>
        <CardHeader><CardTitle className="text-base">기본 정보</CardTitle></CardHeader>
        <CardContent>
          <dl className="product-info-grid">
            <div>
              <dt className="product-info-label">카테고리</dt>
              <dd>{product.category_name ?? '-'}</dd>
            </div>
            <div>
              <dt className="product-info-label">인기도 단계</dt>
              <dd>
                {product.current_popularity_stage ? (
                  <Badge variant="secondary" className={cn('text-xs', POPULARITY_STAGE_COLORS[product.current_popularity_stage as PopularityStage])}>
                    {POPULARITY_STAGE_LABELS[product.current_popularity_stage as PopularityStage]}
                  </Badge>
                ) : '-'}
              </dd>
            </div>
            <div>
              <dt className="product-info-label">대표 키워드</dt>
              <dd>{product.representative_keyword ?? '-'} ({formatRank(product.representative_keyword_rank)})</dd>
            </div>
            <div>
              <dt className="product-info-label">태그</dt>
              <dd className="product-tags">
                {product.tags?.map((t: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                )) ?? '-'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* 키워드별 최신 순위 */}
      <Card>
        <CardHeader><CardTitle className="text-base">키워드별 순위 ({latestRanks.length}개)</CardTitle></CardHeader>
        <CardContent>
          {latestRanks.length > 0 ? (
            <KeywordRanksTableClient data={latestRanks} />
          ) : (
            <p className="text-sm text-muted-foreground">순위 데이터가 없습니다. 상품 관리에서 순위추적 버튼을 눌러주세요.</p>
          )}
        </CardContent>
      </Card>

      {/* 순위 트렌드 */}
      <ProductRankChart data={rankings} />

      {/* 연결 키워드 */}
      <Card>
        <CardHeader><CardTitle className="text-base">연결 키워드 ({keywords.length}개)</CardTitle></CardHeader>
        <CardContent>
          <ProductKeywordsTableClient data={keywords} />
        </CardContent>
      </Card>
    </div>
  );
}
