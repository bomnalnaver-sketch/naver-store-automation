/**
 * @file ProductsTableClient.tsx
 * @description 상품 목록 DataTable 클라이언트 컴포넌트
 */

'use client';

import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTable/DataTableColumnHeader';
import type { ProductRow } from '@/lib/supabase/types';
import type { PopularityStage } from '@/lib/supabase/types';
import { POPULARITY_STAGE_LABELS, POPULARITY_STAGE_COLORS } from '@/lib/constants/colors';
import { formatRank, formatDateFull, formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import { RepKeywordCell } from '@/components/products/RepKeywordCell';
import { RankTrackButton } from '@/components/products/RankTrackButton';

const columns: ColumnDef<ProductRow>[] = [
  {
    accessorKey: 'naver_product_id',
    header: ({ column }) => <DataTableColumnHeader column={column} title="상품 ID" />,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-mono">
        {row.original.naver_product_id ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'naver_shopping_product_id',
    header: ({ column }) => <DataTableColumnHeader column={column} title="쇼핑 ID" />,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-mono">
        {row.original.naver_shopping_product_id ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'product_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="상품명" />,
    cell: ({ row }) => (
      <Link
        href={`/products/${row.original.id}`}
        className="font-medium text-primary hover:underline block max-w-[220px] truncate"
        title={row.original.product_name}
      >
        {row.original.product_name}
      </Link>
    ),
  },
  {
    accessorKey: 'category_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="카테고리" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground block max-w-[150px] truncate" title={row.original.category_name ?? undefined}>
        {row.original.category_name ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'current_popularity_stage',
    header: '인기도',
    cell: ({ row }) => {
      const stage = row.original.current_popularity_stage as PopularityStage | null;
      if (!stage) return '-';
      return (
        <Badge variant="secondary" className={cn('text-xs', POPULARITY_STAGE_COLORS[stage])}>
          {POPULARITY_STAGE_LABELS[stage]}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'representative_keyword',
    header: '대표 키워드',
    cell: ({ row }) => (
      <RepKeywordCell productId={row.original.id} currentKeyword={row.original.representative_keyword} />
    ),
  },
  {
    accessorKey: 'representative_keyword_rank',
    header: ({ column }) => <DataTableColumnHeader column={column} title="대표 순위" />,
    cell: ({ row }) => (
      <span className="text-sm">
        {formatRank(row.original.representative_keyword_rank)}
      </span>
    ),
  },
  {
    accessorKey: 'weekly_orders',
    header: ({ column }) => <DataTableColumnHeader column={column} title="주간 주문" />,
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {row.original.weekly_orders != null ? `${formatNumber(row.original.weekly_orders)}건` : '-'}
      </span>
    ),
  },
  {
    accessorKey: 'weekly_sales',
    header: ({ column }) => <DataTableColumnHeader column={column} title="주간 매출" />,
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.weekly_sales != null ? `${formatNumber(row.original.weekly_sales)}원` : '-'}
      </span>
    ),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => <DataTableColumnHeader column={column} title="등록일" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDateFull(row.original.created_at)}
      </span>
    ),
  },
  {
    id: 'rank_track',
    header: '순위추적',
    cell: ({ row }) => (
      <RankTrackButton
        productId={row.original.id}
        hasKeyword={!!row.original.representative_keyword}
        hasShoppingId={!!row.original.naver_shopping_product_id}
      />
    ),
  },
];

interface ProductsTableClientProps {
  data: ProductRow[];
}

export function ProductsTableClient({ data }: ProductsTableClientProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="product_name"
      searchPlaceholder="상품명 검색..."
    />
  );
}
