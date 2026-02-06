/**
 * @file AiTableClient.tsx
 * @description AI 의사결정 이력 DataTable 클라이언트 컴포넌트
 */

'use client';

import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTable/DataTableColumnHeader';
import type { AiDecisionRow } from '@/lib/supabase/types';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';

const DECISION_TYPE_LABELS: Record<string, string> = {
  keyword_evaluation: '키워드 평가',
  keyword_discovery: '키워드 발굴',
  product_optimization: '상품 최적화',
};

const columns: ColumnDef<AiDecisionRow>[] = [
  {
    accessorKey: 'decision_type',
    header: '유형',
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {DECISION_TYPE_LABELS[row.original.decision_type] ?? row.original.decision_type}
      </Badge>
    ),
  },
  {
    accessorKey: 'model',
    header: '모델',
    cell: ({ row }) => <span className="text-sm">{row.original.model ?? '-'}</span>,
  },
  {
    accessorKey: 'tokens_used',
    header: ({ column }) => <DataTableColumnHeader column={column} title="토큰" />,
    cell: ({ row }) => (
      <span className="text-right block tabular-nums text-sm">{formatNumber(row.original.tokens_used)}</span>
    ),
  },
  {
    accessorKey: 'execution_time_ms',
    header: ({ column }) => <DataTableColumnHeader column={column} title="실행시간" />,
    cell: ({ row }) => (
      <span className="text-right block tabular-nums text-sm">
        {row.original.execution_time_ms ? `${(row.original.execution_time_ms / 1000).toFixed(1)}s` : '-'}
      </span>
    ),
  },
  {
    accessorKey: 'created_at',
    header: '시간',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{formatRelativeTime(row.original.created_at)}</span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Link href={`/ai/${row.original.id}`} className="text-sm text-primary hover:underline">
        상세
      </Link>
    ),
  },
];

interface AiTableClientProps {
  data: AiDecisionRow[];
}

export function AiTableClient({ data }: AiTableClientProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="decision_type"
      searchPlaceholder="유형 검색..."
    />
  );
}
