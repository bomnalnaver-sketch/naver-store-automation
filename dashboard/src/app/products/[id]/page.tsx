/**
 * @file [id]/page.tsx
 * @description 상품 상세 페이지
 */

import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchProductById, fetchProductKeywords, fetchProductRankings } from '@/lib/queries/products';
import { TypeBadge } from '@/components/shared/TypeBadge';
import { ColorBadge } from '@/components/shared/ColorBadge';
import { RankTrendChart } from '@/components/products/RankTrendChart';
import { formatNumber, formatRank } from '@/lib/utils/formatters';
import { POPULARITY_STAGE_LABELS, POPULARITY_STAGE_COLORS } from '@/lib/constants/colors';
import type { PopularityStage } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import './page.css';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await fetchProductById(Number(id));
  if (!product) notFound();

  const [keywords, rankings] = await Promise.all([
    fetchProductKeywords(product.id),
    product.naver_shopping_product_id
      ? fetchProductRankings(product.naver_shopping_product_id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="product-detail-page">
      <h1 className="product-detail-title">{product.product_name}</h1>

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

      {/* 키워드 목록 */}
      <Card>
        <CardHeader><CardTitle className="text-base">연결 키워드 ({keywords.length}개)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>키워드</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>색깔</TableHead>
                <TableHead className="text-right">월간 검색량</TableHead>
                <TableHead>배치</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">연결된 키워드가 없습니다</TableCell>
                </TableRow>
              ) : (
                keywords.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.keyword}</TableCell>
                    <TableCell><TypeBadge type={k.keyword_type} /></TableCell>
                    <TableCell><ColorBadge color={k.color_class} /></TableCell>
                    <TableCell className="text-right">{formatNumber(k.monthly_total_search)}</TableCell>
                    <TableCell className="text-sm">{k.placement}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 순위 트렌드 */}
      <RankTrendChart data={rankings} />
    </div>
  );
}
