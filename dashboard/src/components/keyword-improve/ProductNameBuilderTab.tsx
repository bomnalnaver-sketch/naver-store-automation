/**
 * @file ProductNameBuilderTab.tsx
 * @description 최종 상품명 제작 + 스토어 적용 탭
 * @responsibilities
 * - 키워드 풀에서 클릭으로 상품명 구성
 * - 실시간 글자 수 카운터
 * - 직접 편집 가능한 에디터
 * - DB 저장 / 네이버 스토어 적용
 */

'use client';

import { useState, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, Upload, RotateCcw, X, Plus } from 'lucide-react';
import {
  saveProductName,
  applyProductNameToStore,
} from '@/lib/actions/keyword-improve-actions';
import type { MappedKeywordWithMetrics, CandidateKeywordForImprove } from '@/lib/queries/keyword-improve';
import { formatNumber } from '@/lib/utils/formatters';

interface ProductNameBuilderTabProps {
  productId: number;
  productName: string;
  mappedKeywords: MappedKeywordWithMetrics[];
  candidates: CandidateKeywordForImprove[];
}

export function ProductNameBuilderTab({
  productId,
  productName,
  mappedKeywords,
  candidates,
}: ProductNameBuilderTabProps) {
  const [editedName, setEditedName] = useState(productName);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const charCount = editedName.length;
  const isOverLimit = charCount > 100;
  const hasChanges = editedName !== productName;

  // 키워드 풀: 매핑 + 승인된 후보
  const keywordPool = useMemo(() => {
    const pool: { keyword: string; source: string; score: number }[] = [];

    for (const kw of mappedKeywords) {
      pool.push({
        keyword: kw.keyword,
        source: 'mapped',
        score: kw.priorityScore,
      });
    }

    const approvedCandidates = candidates.filter((c) => c.approvalStatus === 'approved');
    for (const c of approvedCandidates) {
      // 이미 매핑에 있으면 스킵
      if (mappedKeywords.some((m) => m.keyword.toLowerCase() === c.keyword.toLowerCase())) continue;
      pool.push({
        keyword: c.keyword,
        source: 'candidate',
        score: c.candidateScore,
      });
    }

    return pool.sort((a, b) => b.score - a.score);
  }, [mappedKeywords, candidates]);

  // 현재 편집 중인 상품명에 포함된 키워드 체크
  const nameTokensLower = useMemo(() => {
    const nameNoSpace = editedName.toLowerCase().replace(/\s+/g, '');
    return nameNoSpace;
  }, [editedName]);

  const isKeywordInName = (keyword: string) => {
    const kwNoSpace = keyword.toLowerCase().replace(/\s+/g, '');
    return nameTokensLower.includes(kwNoSpace);
  };

  // 키워드 추가 (클릭)
  const addKeyword = (keyword: string) => {
    if (isKeywordInName(keyword)) return;
    const newName = editedName ? `${editedName} ${keyword}` : keyword;
    if (newName.length <= 100) {
      setEditedName(newName);
      setMessage(null);
    } else {
      setMessage({ type: 'error', text: '100자를 초과하여 추가할 수 없습니다.' });
    }
  };

  // 토큰 제거 (에디터 내 토큰 클릭)
  const removeToken = (index: number) => {
    const tokens = editedName.split(/\s+/);
    tokens.splice(index, 1);
    setEditedName(tokens.join(' '));
    setMessage(null);
  };

  // 원래 상태로 복구
  const handleReset = () => {
    setEditedName(productName);
    setMessage(null);
  };

  // DB에만 저장
  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProductName(productId, editedName);
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
    });
  };

  // 스토어에 적용
  const handleApplyToStore = () => {
    startTransition(async () => {
      const result = await applyProductNameToStore(productId, editedName);
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
    });
  };

  const tokens = editedName.split(/\s+/).filter(Boolean);

  return (
    <div className="ki-name-editor">
      {/* 상품명 에디터 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">상품명 편집</h3>
          <span className={`ki-char-count ${isOverLimit ? 'ki-char-count-warn' : ''}`}>
            {charCount}/100자
          </span>
        </div>

        <textarea
          className="ki-name-input"
          value={editedName}
          onChange={(e) => {
            setEditedName(e.target.value);
            setMessage(null);
          }}
          placeholder="상품명을 입력하세요"
          rows={2}
        />

        {/* 토큰 시각화 */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tokens.map((token, idx) => {
            const isMapped = mappedKeywords.some(
              (kw) => kw.keyword.toLowerCase() === token.toLowerCase()
            );
            return (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                  isMapped
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
                title="클릭하여 제거"
                onClick={() => removeToken(idx)}
              >
                {token}
                <X className="w-3 h-3 opacity-60" />
              </span>
            );
          })}
        </div>
      </div>

      {/* 키워드 풀 */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          키워드 풀 (클릭하여 추가)
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {keywordPool.map((kp, idx) => {
            const inName = isKeywordInName(kp.keyword);
            return (
              <button
                key={idx}
                onClick={() => addKeyword(kp.keyword)}
                disabled={inName}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  inName
                    ? 'opacity-40 cursor-not-allowed border-transparent bg-gray-100 dark:bg-gray-800'
                    : kp.source === 'mapped'
                    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'
                    : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40'
                }`}
                title={`${kp.keyword} (점수: ${kp.score.toFixed(1)})`}
              >
                <Plus className="w-3 h-3" />
                {kp.keyword}
                <span className="opacity-60">{kp.score.toFixed(0)}</span>
              </button>
            );
          })}
        </div>
        {keywordPool.length === 0 && (
          <p className="text-sm text-muted-foreground">키워드 풀이 비어있습니다</p>
        )}
      </Card>

      {/* 메시지 */}
      {message && (
        <div
          className={`text-sm px-4 py-3 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="ki-name-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={!hasChanges || isPending}
          className="gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          초기화
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || isOverLimit || isPending}
          className="gap-1"
        >
          <Save className="w-3.5 h-3.5" />
          DB 저장
        </Button>
        <Button
          size="sm"
          onClick={handleApplyToStore}
          disabled={!hasChanges || isOverLimit || isPending}
          className="gap-1"
        >
          <Upload className="w-3.5 h-3.5" />
          스토어 적용
        </Button>
      </div>
    </div>
  );
}
