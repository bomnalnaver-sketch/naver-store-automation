/**
 * @file KeywordsTableClient.tsx
 * @description 키워드 목록 DataTable 클라이언트 컴포넌트
 */

'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTable/DataTableColumnHeader';
import { TypeBadge } from '@/components/shared/TypeBadge';
import { ColorBadge } from '@/components/shared/ColorBadge';
import type { KeywordRow } from '@/lib/supabase/types';
import { formatNumber } from '@/lib/utils/formatters';

const columns: ColumnDef<KeywordRow>[] = [
  {
    accessorKey: 'keyword',
    header: ({ column }) => <DataTableColumnHeader column={column} title="키워드" />,
    cell: ({ row }) => <span className="font-medium">{row.original.keyword}</span>,
  },
  {
    accessorKey: 'keyword_type',
    header: '유형',
    cell: ({ row }) => <TypeBadge type={row.original.keyword_type} />,
  },
  {
    accessorKey: 'color_class',
    header: '색깔',
    cell: ({ row }) => <ColorBadge color={row.original.color_class} />,
  },
  {
    accessorKey: 'monthly_total_search',
    header: ({ column }) => <DataTableColumnHeader column={column} title="월간 검색량" />,
    cell: ({ row }) => (
      <span className="text-right block tabular-nums">
        {formatNumber(row.original.monthly_total_search)}
      </span>
    ),
  },
  {
    accessorKey: 'competition_index',
    header: '경쟁지수',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.competition_index ?? '-'}</span>
    ),
  },
];

interface KeywordsTableClientProps {
  data: KeywordRow[];
}

export function KeywordsTableClient({ data }: KeywordsTableClientProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="keyword"
      searchPlaceholder="키워드 검색..."
    />
  );
}
