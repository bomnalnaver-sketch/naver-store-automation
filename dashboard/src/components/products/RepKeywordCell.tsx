/**
 * @file RepKeywordCell.tsx
 * @description 대표 키워드 인라인 편집 셀
 */

'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { updateRepresentativeKeyword } from '@/lib/actions/product-actions';
import './RepKeywordCell.css';

interface RepKeywordCellProps {
  productId: number;
  currentKeyword: string | null;
}

export function RepKeywordCell({ productId, currentKeyword }: RepKeywordCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentKeyword ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    if (!value.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await updateRepresentativeKeyword(productId, value);
      if (result.success) {
        setEditing(false);
      } else {
        setError(result.error ?? '저장 실패');
      }
    });
  };

  const handleCancel = () => {
    setValue(currentKeyword ?? '');
    setError(null);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (editing) {
    return (
      <div className="rep-keyword-edit">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="rep-keyword-input"
          placeholder="키워드 입력"
          disabled={isPending}
        />
        <Button
          variant="ghost"
          size="icon"
          className="rep-keyword-btn"
          onClick={handleSave}
          disabled={isPending || !value.trim()}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rep-keyword-btn"
          onClick={handleCancel}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        {error && <span className="rep-keyword-error">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`rep-keyword-display ${!currentKeyword ? 'rep-keyword-empty' : ''}`}
      onClick={() => setEditing(true)}
    >
      <span>{currentKeyword ?? '미설정'}</span>
      <Pencil className="rep-keyword-pencil" />
    </button>
  );
}
