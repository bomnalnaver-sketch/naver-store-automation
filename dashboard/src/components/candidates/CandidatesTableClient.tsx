/**
 * @file CandidatesTableClient.tsx
 * @description 키워드 후보 테이블 클라이언트 컴포넌트 (승인/거부/금지어 액션 + 일괄 처리)
 */

'use client';

import { useState, useTransition } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/DataTable/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTable/DataTableColumnHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Ban, Trash2, Loader2 } from 'lucide-react';
import type { KeywordCandidateWithProduct, CandidateSource, CompetitionIndex } from '@/lib/supabase/types';
import {
  approveCandidate,
  rejectCandidate,
  blacklistCandidate,
  deleteCandidate,
  approveCandidatesBulk,
  rejectCandidatesBulk,
  blacklistCandidatesBulk,
  deleteCandidatesBulk,
} from '@/lib/actions/candidate-actions';
import { formatNumber } from '@/lib/utils/formatters';
import './CandidatesTableClient.css';

// 소스 라벨
const SOURCE_LABELS: Record<CandidateSource, string> = {
  product_name: '상품명',
  search_ad: '검색광고',
  competitor: '경쟁사',
};

const SOURCE_COLORS: Record<CandidateSource, string> = {
  product_name: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  search_ad: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  competitor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

// 경쟁지수 색상
const COMPETITION_COLORS: Record<CompetitionIndex, string> = {
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  HIGH: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

interface ActionCellProps {
  candidate: KeywordCandidateWithProduct;
  onAction: () => void;
}

function ActionCell({ candidate, onAction }: ActionCellProps) {
  const [isPending, startTransition] = useTransition();
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'blacklist' | 'delete' | null>(null);

  const handleApprove = () => {
    setActionType('approve');
    startTransition(async () => {
      const result = await approveCandidate(candidate.id);
      if (!result.success) {
        console.error(result.error);
      }
      onAction();
    });
  };

  const handleReject = () => {
    setActionType('reject');
    startTransition(async () => {
      const result = await rejectCandidate(candidate.id, '관련성 낮음');
      if (!result.success) {
        console.error(result.error);
      }
      onAction();
    });
  };

  const handleBlacklist = () => {
    setActionType('blacklist');
    startTransition(async () => {
      const result = await blacklistCandidate(candidate.id);
      if (!result.success) {
        console.error(result.error);
      }
      onAction();
    });
  };

  const handleDelete = () => {
    setActionType('delete');
    startTransition(async () => {
      const result = await deleteCandidate(candidate.id);
      if (!result.success) {
        console.error(result.error);
      }
      onAction();
    });
  };

  return (
    <div className="candidate-action-buttons">
      <Button
        variant="outline"
        size="sm"
        className="candidate-approve-btn"
        onClick={handleApprove}
        disabled={isPending}
        title="승인"
      >
        {isPending && actionType === 'approve' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="candidate-reject-btn"
        onClick={handleReject}
        disabled={isPending}
        title="거부"
      >
        {isPending && actionType === 'reject' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="candidate-blacklist-btn"
        onClick={handleBlacklist}
        disabled={isPending}
        title="금지어로 등록"
      >
        {isPending && actionType === 'blacklist' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Ban className="w-4 h-4" />
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="candidate-delete-btn"
        onClick={handleDelete}
        disabled={isPending}
        title="삭제 (재발굴 가능)"
      >
        {isPending && actionType === 'delete' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

interface BulkActionsProps {
  selectedRows: KeywordCandidateWithProduct[];
  clearSelection: () => void;
  onAction: () => void;
}

function BulkActions({ selectedRows, clearSelection, onAction }: BulkActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'blacklist' | 'delete' | null>(null);

  const ids = selectedRows.map((r) => r.id);

  const handleBulkApprove = () => {
    setActionType('approve');
    startTransition(async () => {
      const result = await approveCandidatesBulk(ids);
      if (!result.success) console.error(result.error);
      clearSelection();
      onAction();
    });
  };

  const handleBulkReject = () => {
    setActionType('reject');
    startTransition(async () => {
      const result = await rejectCandidatesBulk(ids, '일괄 거부');
      if (!result.success) console.error(result.error);
      clearSelection();
      onAction();
    });
  };

  const handleBulkBlacklist = () => {
    setActionType('blacklist');
    startTransition(async () => {
      const result = await blacklistCandidatesBulk(ids);
      if (!result.success) console.error(result.error);
      clearSelection();
      onAction();
    });
  };

  const handleBulkDelete = () => {
    setActionType('delete');
    startTransition(async () => {
      const result = await deleteCandidatesBulk(ids);
      if (!result.success) console.error(result.error);
      clearSelection();
      onAction();
    });
  };

  return (
    <div className="candidate-bulk-actions">
      <span className="candidate-bulk-count">{selectedRows.length}개 선택</span>
      <Button
        variant="outline"
        size="sm"
        className="candidate-approve-btn"
        onClick={handleBulkApprove}
        disabled={isPending}
      >
        {isPending && actionType === 'approve' ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          <Check className="w-4 h-4 mr-1" />
        )}
        일괄 승인
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="candidate-reject-btn"
        onClick={handleBulkReject}
        disabled={isPending}
      >
        {isPending && actionType === 'reject' ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          <X className="w-4 h-4 mr-1" />
        )}
        일괄 거부
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="candidate-blacklist-btn"
        onClick={handleBulkBlacklist}
        disabled={isPending}
      >
        {isPending && actionType === 'blacklist' ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          <Ban className="w-4 h-4 mr-1" />
        )}
        일괄 금지어
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="candidate-delete-btn"
        onClick={handleBulkDelete}
        disabled={isPending}
      >
        {isPending && actionType === 'delete' ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          <Trash2 className="w-4 h-4 mr-1" />
        )}
        일괄 삭제
      </Button>
    </div>
  );
}

interface CandidatesTableClientProps {
  data: KeywordCandidateWithProduct[];
}

export function CandidatesTableClient({ data }: CandidatesTableClientProps) {
  const [key, setKey] = useState(0);

  const handleAction = () => {
    setKey((k) => k + 1);
  };

  const columns: ColumnDef<KeywordCandidateWithProduct>[] = [
    {
      accessorKey: 'keyword',
      header: ({ column }) => <DataTableColumnHeader column={column} title="키워드" />,
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.keyword}</span>
          {row.original.filter_reason && (
            <p className="text-xs text-muted-foreground mt-1">{row.original.filter_reason}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'product_name',
      header: '상품',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {row.original.product_name ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'source',
      header: '발굴 소스',
      cell: ({ row }) => (
        <Badge variant="secondary" className={SOURCE_COLORS[row.original.source]}>
          {SOURCE_LABELS[row.original.source]}
        </Badge>
      ),
    },
    {
      accessorKey: 'monthly_search_volume',
      header: ({ column }) => <DataTableColumnHeader column={column} title="월간 검색량" />,
      cell: ({ row }) => (
        <span className="text-right block tabular-nums">
          {formatNumber(row.original.monthly_search_volume)}
        </span>
      ),
    },
    {
      accessorKey: 'competition_index',
      header: '경쟁지수',
      cell: ({ row }) => {
        const idx = row.original.competition_index;
        if (!idx) return <span className="text-muted-foreground">-</span>;
        return (
          <Badge variant="secondary" className={COMPETITION_COLORS[idx]}>
            {idx}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'category_match_ratio',
      header: ({ column }) => <DataTableColumnHeader column={column} title="관련성" />,
      cell: ({ row }) => {
        const ratio = row.original.category_match_ratio;
        if (ratio === null) return <span className="text-muted-foreground">-</span>;
        const percent = Math.round(ratio * 100);
        const colorClass = percent >= 50 ? 'text-green-600' : percent >= 30 ? 'text-amber-600' : 'text-red-600';
        return <span className={`font-medium ${colorClass}`}>{percent}%</span>;
      },
    },
    {
      accessorKey: 'candidate_score',
      header: ({ column }) => <DataTableColumnHeader column={column} title="점수" />,
      cell: ({ row }) => (
        <span className="font-bold text-right block tabular-nums">
          {row.original.candidate_score.toFixed(1)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '액션',
      cell: ({ row }) => <ActionCell candidate={row.original} onAction={handleAction} />,
    },
  ];

  return (
    <DataTable
      key={key}
      columns={columns}
      data={data}
      searchKey="keyword"
      searchPlaceholder="키워드 검색..."
      enableRowSelection
      renderBulkActions={(selectedRows, clearSelection) => (
        <BulkActions
          selectedRows={selectedRows as KeywordCandidateWithProduct[]}
          clearSelection={clearSelection}
          onAction={handleAction}
        />
      )}
    />
  );
}
