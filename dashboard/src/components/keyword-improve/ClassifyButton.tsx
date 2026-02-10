/**
 * @file ClassifyButton.tsx
 * @description 키워드 매핑 생성 + 분류 버튼
 * @responsibilities
 * - 키워드 분류 트리거
 * - 로딩/결과 상태 표시
 */

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Tags, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { triggerKeywordClassification } from '@/lib/actions/keyword-improve-actions';
import type { ClassifyResult } from '@/lib/actions/keyword-improve-actions';

export function ClassifyButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ClassifyResult | null>(null);

  const handleClassify = () => {
    setResult(null);
    startTransition(async () => {
      const res = await triggerKeywordClassification();
      setResult(res);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClassify}
        disabled={isPending}
        className="gap-1.5"
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            분류 중...
          </>
        ) : (
          <>
            <Tags className="w-3.5 h-3.5" />
            키워드 분류
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
