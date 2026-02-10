/**
 * @file DiscoverButton.tsx
 * @description 키워드 발굴 수동 트리거 버튼
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { triggerKeywordDiscovery, type DiscoveryResult } from '@/lib/actions/discovery-actions';
import './DiscoverButton.css';

export function DiscoverButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<DiscoveryResult | null>(null);

  const handleClick = () => {
    setResult(null);
    startTransition(async () => {
      const res = await triggerKeywordDiscovery();
      setResult(res);
    });
  };

  return (
    <div className="discover-button-wrapper">
      <Button
        onClick={handleClick}
        disabled={isPending}
        variant="default"
        size="sm"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            발굴 중...
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-1.5" />
            키워드 발굴 실행
          </>
        )}
      </Button>
      {result && (
        <span className={`discover-result-badge ${result.success ? 'discover-result-success' : 'discover-result-error'}`}>
          {result.success
            ? `${result.totalDiscovered}개 발굴 / ${result.totalSelected}개 선정`
            : '실패'}
        </span>
      )}
    </div>
  );
}
