/**
 * @file CandidateTab.tsx
 * @description 후보관리 탭 - 후보 키워드 목록 및 승인/거부
 * @responsibilities
 * - 후보 키워드 테이블 표시
 * - 승인/거부/금지어 액션
 * - 매핑된 키워드와의 비교 표시
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  approveCandidate,
  rejectCandidate,
  blacklistCandidate,
} from '@/lib/actions/candidate-actions';
import type { MappedKeywordWithMetrics, CandidateKeywordForImprove } from '@/lib/queries/keyword-improve';
import { formatNumber } from '@/lib/utils/formatters';

interface CandidateTabProps {
  productId: number;
  candidates: CandidateKeywordForImprove[];
  mappedKeywords: MappedKeywordWithMetrics[];
}

export function CandidateTab({ productId, candidates, mappedKeywords }: CandidateTabProps) {
  const [localCandidates, setLocalCandidates] = useState(candidates);

  const pendingCandidates = localCandidates.filter((c) => c.approvalStatus === 'pending');
  const approvedCandidates = localCandidates.filter((c) => c.approvalStatus === 'approved');

  function handleActionComplete(candidateId: number) {
    setLocalCandidates((prev) => prev.filter((c) => c.id !== candidateId));
  }

  return (
    <div>
      {/* 승인 대기 */}
      <div style={{ marginBottom: 32 }}>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          승인 대기 ({pendingCandidates.length}개)
        </h3>
        {pendingCandidates.length > 0 ? (
          <table className="ki-kw-table">
            <thead>
              <tr>
                <th>키워드</th>
                <th>소스</th>
                <th>월간 검색량</th>
                <th>경쟁강도</th>
                <th>후보 점수</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {pendingCandidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  onAction={handleActionComplete}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="ki-empty">
            <p className="ki-empty-title">승인 대기 중인 후보가 없습니다</p>
            <p className="ki-empty-desc">키워드 발굴을 실행하면 후보가 생성됩니다</p>
          </div>
        )}
      </div>

      {/* 승인됨 */}
      {approvedCandidates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            승인됨 ({approvedCandidates.length}개)
          </h3>
          <table className="ki-kw-table">
            <thead>
              <tr>
                <th>키워드</th>
                <th>소스</th>
                <th>월간 검색량</th>
                <th>경쟁강도</th>
                <th>상태</th>
                <th>기여도</th>
              </tr>
            </thead>
            <tbody>
              {approvedCandidates.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.keyword}</td>
                  <td>
                    <SourceBadge source={c.source} />
                  </td>
                  <td>{formatNumber(c.monthlySearchVolume)}</td>
                  <td>
                    <CompetitionBadge index={c.competitionIndex} />
                  </td>
                  <td>
                    <Badge variant="outline" className="text-xs">{c.status}</Badge>
                  </td>
                  <td>{c.contributionScore > 0 ? c.contributionScore.toFixed(1) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  candidate,
  onAction,
}: {
  candidate: CandidateKeywordForImprove;
  onAction: (id: number) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      await approveCandidate(candidate.id);
      onAction(candidate.id);
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectCandidate(candidate.id, '수동 거부');
      onAction(candidate.id);
    });
  };

  const handleBlacklist = () => {
    startTransition(async () => {
      await blacklistCandidate(candidate.id);
      onAction(candidate.id);
    });
  };

  return (
    <tr style={{ opacity: isPending ? 0.5 : 1 }}>
      <td className="font-medium">{candidate.keyword}</td>
      <td>
        <SourceBadge source={candidate.source} />
      </td>
      <td>{formatNumber(candidate.monthlySearchVolume)}</td>
      <td>
        <CompetitionBadge index={candidate.competitionIndex} />
      </td>
      <td className="font-medium">{candidate.candidateScore}</td>
      <td>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={handleApprove}
            disabled={isPending}
            className="h-7 text-xs"
          >
            승인
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={isPending}
            className="h-7 text-xs"
          >
            거부
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBlacklist}
            disabled={isPending}
            className="h-7 text-xs"
          >
            금지
          </Button>
        </div>
      </td>
    </tr>
  );
}

function SourceBadge({ source }: { source: string }) {
  const label =
    source === 'competitor' ? '경쟁사' :
    source === 'search_ad' ? '검색광고' :
    source === 'product_name' ? '상품명' : source;

  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  );
}

function CompetitionBadge({ index }: { index: string | null }) {
  if (!index) return <span className="text-muted-foreground text-xs">-</span>;

  const color =
    index === 'LOW' ? 'text-green-600 dark:text-green-400' :
    index === 'MEDIUM' ? 'text-yellow-600 dark:text-yellow-400' :
    'text-red-600 dark:text-red-400';

  return <span className={`text-xs font-medium ${color}`}>{index}</span>;
}
