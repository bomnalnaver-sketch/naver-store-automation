/**
 * @file KeywordRanksTableClient.tsx
 * @description 키워드별 최신 순위 테이블
 */

'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTable/DataTableColumnHeader';

interface KeywordRank {
  keyword: string;
  rank: number | null;
  checked_at: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const columns: ColumnDef<KeywordRank>[] = [
  {
    accessorKey: 'keyword',
    header: ({ column }) => <DataTableColumnHeader column={column} title="키워드" />,
    cell: ({ row }) => <span className="font-medium text-sm">{row.original.keyword}</span>,
  },
  {
    accessorKey: 'rank',
    header: ({ column }) => <DataTableColumnHeader column={column} title="순위" />,
    cell: ({ row }) => {
      const rank = row.original.rank;
      if (rank == null) {
        return <Badge variant="outline" className="text-xs text-muted-foreground">1000위 밖</Badge>;
      }
      const color = rank <= 10
        ? 'text-green-600 dark:text-green-400'
        : rank <= 40
          ? 'text-blue-600 dark:text-blue-400'
          : rank <= 100
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-muted-foreground';
      return <span className={`text-sm font-semibold ${color}`}>{rank}위</span>;
    },
  },
  {
    accessorKey: 'checked_at',
    header: '측정 시간',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(row.original.checked_at)}
      </span>
    ),
  },
];

interface KeywordRanksTableClientProps {
  data: KeywordRank[];
}

export function KeywordRanksTableClient({ data }: KeywordRanksTableClientProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="keyword"
      searchPlaceholder="키워드 검색..."
    />
  );
}
