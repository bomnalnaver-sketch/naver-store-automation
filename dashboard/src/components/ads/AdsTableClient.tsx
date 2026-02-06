/**
 * @file AdsTableClient.tsx
 * @description 광고 키워드 DataTable 클라이언트 컴포넌트
 */

'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTable/DataTableColumnHeader';
import type { AdKeywordWithStats } from '@/lib/queries/ads';
import { formatNumber, formatCurrency, formatPercent, getRoasColorClass } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

const columns: ColumnDef<AdKeywordWithStats>[] = [
  {
    accessorKey: 'keyword',
    header: ({ column }) => <DataTableColumnHeader column={column} title="키워드" />,
    cell: ({ row }) => <span className="font-medium">{row.original.keyword}</span>,
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'} className="text-xs">
        {row.original.status === 'active' ? '활성' : row.original.status === 'paused' ? '일시중지' : '제거'}
      </Badge>
    ),
  },
  {
    accessorKey: 'bid_amount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="입찰가" />,
    cell: ({ row }) => (
      <span className="text-right block tabular-nums">{formatCurrency(row.original.bid_amount)}</span>
    ),
  },
  {
    accessorKey: 'total_impressions',
    header: ({ column }) => <DataTableColumnHeader column={column} title="노출" />,
    cell: ({ row }) => (
      <span className="text-right block tabular-nums">{formatNumber(row.original.total_impressions)}</span>
    ),
  },
  {
    accessorKey: 'total_clicks',
    header: ({ column }) => <DataTableColumnHeader column={column} title="클릭" />,
    cell: ({ row }) => (
      <span className="text-right block tabular-nums">{formatNumber(row.original.total_clicks)}</span>
    ),
  },
  {
    accessorKey: 'total_conversions',
    header: ({ column }) => <DataTableColumnHeader column={column} title="전환" />,
    cell: ({ row }) => (
      <span className="text-right block tabular-nums">{formatNumber(row.original.total_conversions)}</span>
    ),
  },
  {
    accessorKey: 'avg_roas',
    header: ({ column }) => <DataTableColumnHeader column={column} title="ROAS" />,
    cell: ({ row }) => (
      <span className={cn('text-right block font-medium tabular-nums', getRoasColorClass(row.original.avg_roas))}>
        {row.original.avg_roas != null ? formatPercent(row.original.avg_roas, 0) : '-'}
      </span>
    ),
  },
];

interface AdsTableClientProps {
  data: AdKeywordWithStats[];
}

export function AdsTableClient({ data }: AdsTableClientProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="keyword"
      searchPlaceholder="키워드 검색..."
    />
  );
}
