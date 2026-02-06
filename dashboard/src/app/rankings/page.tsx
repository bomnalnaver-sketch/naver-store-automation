/**
 * @file page.tsx
 * @description 순위 추적 페이지
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTimeline } from '@/components/rankings/AlertTimeline';
import { fetchRankingAlerts, fetchProductsByPopularity } from '@/lib/queries/rankings';
import { formatRank } from '@/lib/utils/formatters';
import { POPULARITY_STAGE_LABELS, POPULARITY_STAGE_COLORS } from '@/lib/constants/colors';
import { cn } from '@/lib/utils';
import type { PopularityStage, ProductRow } from '@/lib/supabase/types';
import './page.css';

export default async function RankingsPage() {
  const [alerts, groups] = await Promise.all([
    fetchRankingAlerts(),
    fetchProductsByPopularity(),
  ]);

  const stages: { key: PopularityStage; products: ProductRow[] }[] = [
    { key: 'stable', products: groups.stable },
    { key: 'growth', products: groups.growth },
    { key: 'extreme_early', products: groups.extreme_early },
  ];

  return (
    <div className="rankings-page">
      <h1 className="rankings-title">순위 추적</h1>

      <div className="rankings-grid">
        {/* 알림 타임라인 */}
        <AlertTimeline alerts={alerts} />

        {/* 인기도 단계별 그룹 */}
        <div className="rankings-groups">
          {stages.map(({ key, products }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="secondary" className={cn('text-xs', POPULARITY_STAGE_COLORS[key])}>
                    {POPULARITY_STAGE_LABELS[key]}
                  </Badge>
                  <span>{products.length}개 상품</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">해당 상품 없음</p>
                ) : (
                  <div className="rankings-product-list">
                    {products.map((p) => (
                      <Link key={p.id} href={`/products/${p.id}`} className="rankings-product-item">
                        <span className="font-medium text-sm">{p.product_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.representative_keyword ?? '-'} · {formatRank(p.representative_keyword_rank)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
