/**
 * @file ReorderTab.tsx
 * @description 순서관리 탭 - 키워드 우선순위 기반 순서 재배치
 * @responsibilities
 * - 현재 키워드 순서와 우선순위 점수 표시
 * - 자동 재배치 미리보기
 * - 재배치 결과 적용
 */

'use client';

import { useState, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Wand2, Check } from 'lucide-react';
import { applyReorderedName } from '@/lib/actions/keyword-improve-actions';
import type { MappedKeywordWithMetrics } from '@/lib/queries/keyword-improve';
import { formatNumber, formatRank } from '@/lib/utils/formatters';

interface ReorderTabProps {
  productId: number;
  productName: string;
  mappedKeywords: MappedKeywordWithMetrics[];
}

export function ReorderTab({ productId, productName, mappedKeywords }: ReorderTabProps) {
  const [reorderedName, setReorderedName] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 현재 상품명의 토큰 순서
  const currentTokens = useMemo(() => productName.split(/\s+/).filter(Boolean), [productName]);

  // 우선순위 점수 순으로 정렬된 키워드
  const sortedKeywords = useMemo(
    () => [...mappedKeywords].sort((a, b) => b.priorityScore - a.priorityScore),
    [mappedKeywords]
  );

  // 자동 재배치 실행
  const handleAutoReorder = () => {
    // 키워드 토큰과 비키워드 토큰 분리
    const keywordTokenMap = new Map<string, MappedKeywordWithMetrics>();
    for (const kw of mappedKeywords) {
      const tokens = kw.keyword.toLowerCase().split(/\s+/);
      for (const t of tokens) {
        keywordTokenMap.set(t, kw);
      }
    }

    // 현재 토큰을 키워드/비키워드로 분류
    const keywordTokens: { token: string; score: number }[] = [];
    const nonKeywordTokens: string[] = [];

    for (const token of currentTokens) {
      const kw = keywordTokenMap.get(token.toLowerCase());
      if (kw) {
        keywordTokens.push({ token, score: kw.priorityScore });
      } else {
        nonKeywordTokens.push(token);
      }
    }

    // 키워드 토큰을 점수 내림차순 정렬
    keywordTokens.sort((a, b) => b.score - a.score);

    // 재조합: 키워드 → 비키워드
    const reordered = [
      ...keywordTokens.map((t) => t.token),
      ...nonKeywordTokens,
    ].join(' ');

    // 100자 제한
    const trimmed = reordered.length > 100 ? reordered.substring(0, 100).trim() : reordered;
    setReorderedName(trimmed);
    setApplied(false);
  };

  // 적용
  const handleApply = () => {
    if (!reorderedName) return;
    startTransition(async () => {
      const result = await applyReorderedName(productId, reorderedName);
      if (result.success) {
        setApplied(true);
      }
    });
  };

  const changed = reorderedName !== null && reorderedName !== productName;

  return (
    <div>
      {/* 현재 키워드 순서 + 우선순위 */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">
        키워드 우선순위 (검색순위 50% + 판매기여도 50%)
      </h3>

      <div style={{ marginBottom: 24 }}>
        {sortedKeywords.length > 0 ? (
          <table className="ki-kw-table">
            <thead>
              <tr>
                <th>#</th>
                <th>키워드</th>
                <th>유형</th>
                <th>검색 순위</th>
                <th>기여도</th>
                <th>우선순위 점수</th>
                <th>월간 검색량</th>
              </tr>
            </thead>
            <tbody>
              {sortedKeywords.map((kw, idx) => (
                <tr key={kw.keywordId}>
                  <td className="text-muted-foreground">{idx + 1}</td>
                  <td className="font-medium">{kw.keyword}</td>
                  <td>
                    <ColorBadge colorClass={kw.colorClass} keywordType={kw.keywordType} />
                  </td>
                  <td>{formatRank(kw.latestRank)}</td>
                  <td>{kw.contributionScore > 0 ? kw.contributionScore.toFixed(1) : '-'}</td>
                  <td>
                    <span className="font-semibold">{kw.priorityScore.toFixed(1)}</span>
                  </td>
                  <td>{formatNumber(kw.monthlyTotalSearch)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="ki-empty">
            <p className="ki-empty-title">매핑된 키워드가 없습니다</p>
            <p className="ki-empty-desc">키워드 분석을 먼저 실행해주세요</p>
          </div>
        )}
      </div>

      {/* 자동 재배치 */}
      {sortedKeywords.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">자동 재배치</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutoReorder}
              className="gap-1"
            >
              <Wand2 className="w-3.5 h-3.5" />
              우선순위 기준 재배치
            </Button>
          </div>

          {reorderedName !== null && (
            <div>
              {/* 비교 뷰 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">현재</p>
                  <div className="ki-name-preview">{productName}</div>
                  <p className="text-xs text-muted-foreground mt-1">{productName.length}자</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">재배치 결과</p>
                  <div className="ki-name-preview">{reorderedName}</div>
                  <p className="text-xs text-muted-foreground mt-1">{reorderedName.length}자</p>
                </div>
              </div>

              {changed ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    키워드 순서가 변경되었습니다
                  </p>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    disabled={isPending || applied}
                    className="gap-1"
                  >
                    {applied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        적용됨
                      </>
                    ) : (
                      '재배치 적용'
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  이미 최적의 순서입니다. 변경이 필요하지 않습니다.
                </p>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function ColorBadge({
  colorClass,
  keywordType,
}: {
  colorClass: string | null;
  keywordType: string | null;
}) {
  const typeLabel = keywordType === 'integral' ? '일체형'
    : keywordType === 'order_fixed' ? '순서고정'
    : keywordType === 'composite' ? '조합형'
    : keywordType === 'synonym' ? '동의어'
    : keywordType === 'redundant' ? '불필요'
    : '-';

  const colorClassName = colorClass === 'yellow' ? 'ki-color-yellow'
    : colorClass === 'green' ? 'ki-color-green'
    : colorClass === 'gray' ? 'ki-color-gray'
    : colorClass === 'blue' ? 'ki-color-blue'
    : colorClass === 'orange' ? 'ki-color-orange'
    : '';

  return (
    <span className={`text-xs font-medium ${colorClassName}`}>
      {typeLabel}
    </span>
  );
}
