/**
 * @file MetricsEnrichButton.tsx
 * @description 검색량/경쟁강도 보강 버튼
 * @responsibilities
 * - 검색량 조회 트리거
 * - 로딩/결과 상태 표시
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { triggerMetricsEnrichment } from '@/lib/actions/keyword-improve-actions';
import type { MetricsEnrichResult } from '@/lib/actions/keyword-improve-actions';

export function MetricsEnrichButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MetricsEnrichResult | null>(null);

  const handleEnrich = () => {
    setResult(null);
    startTransition(async () => {
      const res = await triggerMetricsEnrichment();
      setResult(res);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleEnrich}
        disabled={isPending}
        className="gap-1.5"
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            조회 중...
          </>
        ) : (
          <>
            <Search className="w-3.5 h-3.5" />
            검색량 조회
          </>
        )}
      </Button>

      {result && (
        <span className={`text-xs flex items-center gap-1 ${
          result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {result.success ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          {result.message}
        </span>
      )}
    </div>
  );
}
