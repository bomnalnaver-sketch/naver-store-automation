/**
 * @file page.tsx
 * @description 상품 리스트 페이지
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchProducts } from '@/lib/queries/products';
import { formatNumber, formatRank, formatDateFull } from '@/lib/utils/formatters';
import { POPULARITY_STAGE_LABELS, POPULARITY_STAGE_COLORS } from '@/lib/constants/colors';
import type { PopularityStage } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';
import './page.css';

export default async function ProductsPage() {
  const products = await fetchProducts();

  return (
    <div className="products-page">
      <h1 className="products-title">상품 관리</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">상품 목록 ({products.length}개)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상품명</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>인기도</TableHead>
                <TableHead>대표 키워드</TableHead>
                <TableHead className="text-right">대표 순위</TableHead>
                <TableHead>등록일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    등록된 상품이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id} className="products-row">
                    <TableCell>
                      <Link href={`/products/${p.id}`} className="products-name-link">
                        {p.product_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.category_name ?? '-'}
                    </TableCell>
                    <TableCell>
                      {p.current_popularity_stage ? (
                        <Badge variant="secondary" className={cn('text-xs', POPULARITY_STAGE_COLORS[p.current_popularity_stage as PopularityStage])}>
                          {POPULARITY_STAGE_LABELS[p.current_popularity_stage as PopularityStage]}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.representative_keyword ?? '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatRank(p.representative_keyword_rank)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateFull(p.created_at)}
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
