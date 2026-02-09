/**
 * @file ProductRefreshButton.tsx
 * @description 상품 정보 즉시 동기화 버튼
 * Commerce API에서 상품 목록을 가져와 DB와 즉시 동기화
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { syncAllProducts } from '@/lib/actions/sync-actions';

export function ProductRefreshButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    setMessage(null);
    setIsError(false);

    try {
      const result = await syncAllProducts();
      // 에러가 있으면 상세 내용 포함
      if (result.errors.length > 0) {
        setMessage(`${result.message} (${result.errors[0]})`);
      } else {
        setMessage(result.message);
      }
      setIsError(!result.success);

      // 10초 후 메시지 숨기기 (에러 시 더 오래 표시)
      setTimeout(() => setMessage(null), result.success ? 5000 : 10000);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '알 수 없는 오류';
      setMessage(`동기화 실패: ${errorMsg}`);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleRefresh} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        상품 동기화
      </Button>
      {message && (
        <span className={`text-sm ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
          {message}
        </span>
      )}
    </div>
  );
}
