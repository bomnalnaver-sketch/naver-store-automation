/**
 * @file RankTrackButton.tsx
 * @description 상품별 순위추적 버튼 컴포넌트
 */

'use client';

import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackProductRank } from '@/lib/actions/ranking-actions';
import './RankTrackButton.css';

interface RankTrackButtonProps {
  productId: number;
  hasKeyword: boolean;
  hasShoppingId: boolean;
}

export function RankTrackButton({ productId, hasKeyword, hasShoppingId }: RankTrackButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const disabled = !hasKeyword || !hasShoppingId;

  const handleTrack = () => {
    setMessage(null);
    setIsError(false);
    startTransition(async () => {
      const res = await trackProductRank(productId);
      if (res.success && res.results) {
        const summary = res.results
          .map((r) => `${r.keyword}: ${r.rank != null ? `${r.rank}위` : '1000위 밖'}`)
          .join(', ');
        setMessage(`${res.trackedCount}개 완료 (${summary})`);
      } else {
        setMessage(res.error ?? '실패');
        setIsError(true);
      }
    });
  };

  const buttonLabel = !hasShoppingId
    ? '쇼핑ID 없음'
    : !hasKeyword
      ? '키워드 없음'
      : '순위추적';

  return (
    <div className="rank-track-cell">
      <Button
        variant="outline"
        size="sm"
        className="rank-track-btn"
        onClick={handleTrack}
        disabled={disabled || isPending}
      >
        {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
        {isPending ? '추적 중...' : buttonLabel}
      </Button>
      {message && (
        <span className={isError ? 'rank-track-error' : 'rank-track-result'} title={message}>
          {message}
        </span>
      )}
    </div>
  );
}
