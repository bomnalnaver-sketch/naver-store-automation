/**
 * @file RecommendTab.tsx
 * @description 키워드 변경 추천 탭
 * @responsibilities
 * - 추가 추천: 후보 중 높은 점수 키워드
 * - 제거 추천: 불필요/저성과 키워드
 * - 교체 추천: 동의어 중 더 나은 대안
 */

'use client';

import { useMemo, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ArrowLeftRight } from 'lucide-react';
import {
  addKeywordToProductName,
  removeKeywordFromProductName,
} from '@/lib/actions/keyword-improve-actions';
import type { MappedKeywordWithMetrics, CandidateKeywordForImprove } from '@/lib/queries/keyword-improve';
import { formatNumber } from '@/lib/utils/formatters';

interface RecommendTabProps {
  productId: number;
  productName: string;
  mappedKeywords: MappedKeywordWithMetrics[];
  candidates: CandidateKeywordForImprove[];
}

interface Recommendation {
  type: 'add' | 'remove' | 'swap';
  keyword: string;
  reason: string;
  metrics: {
    monthlySearch?: number;
    competition?: string | null;
    score?: number;
  };
  swapTarget?: string;
}

export function RecommendTab({
  productId,
  productName,
  mappedKeywords,
  candidates,
}: RecommendTabProps) {
  const recommendations = useMemo(
    () => generateRecommendations(productName, mappedKeywords, candidates),
    [productName, mappedKeywords, candidates]
  );

  const addRecs = recommendations.filter((r) => r.type === 'add');
  const removeRecs = recommendations.filter((r) => r.type === 'remove');
  const swapRecs = recommendations.filter((r) => r.type === 'swap');

  return (
    <div>
      {recommendations.length === 0 ? (
        <div className="ki-empty">
          <p className="ki-empty-title">추천 사항이 없습니다</p>
          <p className="ki-empty-desc">
            현재 상품명이 최적화되어 있거나, 후보 키워드가 부족합니다
          </p>
        </div>
      ) : (
        <>
          {/* 추가 추천 */}
          {addRecs.length > 0 && (
            <RecommendSection
              title="추가 추천"
              description="상품명에 추가하면 좋을 키워드"
              recommendations={addRecs}
              productId={productId}
            />
          )}

          {/* 제거 추천 */}
          {removeRecs.length > 0 && (
            <RecommendSection
              title="제거 추천"
              description="상품명에서 제거를 고려할 키워드"
              recommendations={removeRecs}
              productId={productId}
            />
          )}

          {/* 교체 추천 */}
          {swapRecs.length > 0 && (
            <RecommendSection
              title="교체 추천"
              description="더 나은 키워드로 교체"
              recommendations={swapRecs}
              productId={productId}
            />
          )}
        </>
      )}
    </div>
  );
}

function RecommendSection({
  title,
  description,
  recommendations,
  productId,
}: {
  title: string;
  description: string;
  recommendations: Recommendation[];
  productId: number;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="text-sm font-semibold text-muted-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      {recommendations.map((rec, idx) => (
        <RecommendCard key={idx} recommendation={rec} productId={productId} />
      ))}
    </div>
  );
}

function RecommendCard({
  recommendation,
  productId,
}: {
  recommendation: Recommendation;
  productId: number;
}) {
  const [isPending, startTransition] = useTransition();

  const handleAction = () => {
    startTransition(async () => {
      if (recommendation.type === 'add') {
        await addKeywordToProductName(productId, recommendation.keyword);
      } else if (recommendation.type === 'remove') {
        await removeKeywordFromProductName(productId, recommendation.keyword);
      } else if (recommendation.type === 'swap' && recommendation.swapTarget) {
        await removeKeywordFromProductName(productId, recommendation.swapTarget);
        await addKeywordToProductName(productId, recommendation.keyword);
      }
    });
  };

  const typeClass =
    recommendation.type === 'add' ? 'ki-recommend-add' :
    recommendation.type === 'remove' ? 'ki-recommend-remove' : 'ki-recommend-swap';

  const typeLabel =
    recommendation.type === 'add' ? '추가' :
    recommendation.type === 'remove' ? '제거' : '교체';

  const Icon =
    recommendation.type === 'add' ? Plus :
    recommendation.type === 'remove' ? Minus : ArrowLeftRight;

  return (
    <div className="ki-recommend-card">
      <div className="ki-recommend-header">
        <div className="flex items-center gap-2">
          <span className={`ki-recommend-type ${typeClass}`}>{typeLabel}</span>
          <span className="ki-recommend-keyword">{recommendation.keyword}</span>
          {recommendation.swapTarget && (
            <span className="text-xs text-muted-foreground">
              ← {recommendation.swapTarget} 대체
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAction}
          disabled={isPending}
          className="gap-1 h-7 text-xs"
        >
          <Icon className="w-3 h-3" />
          {isPending ? '처리중...' : '적용'}
        </Button>
      </div>
      <p className="ki-recommend-reason">{recommendation.reason}</p>
      <div className="ki-recommend-metrics">
        {recommendation.metrics.monthlySearch !== undefined && (
          <span>검색량: {formatNumber(recommendation.metrics.monthlySearch)}</span>
        )}
        {recommendation.metrics.competition && (
          <span>경쟁: {recommendation.metrics.competition}</span>
        )}
        {recommendation.metrics.score !== undefined && (
          <span>점수: {recommendation.metrics.score}</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// 추천 생성 로직
// ============================================

function generateRecommendations(
  productName: string,
  mappedKeywords: MappedKeywordWithMetrics[],
  candidates: CandidateKeywordForImprove[]
): Recommendation[] {
  const recs: Recommendation[] = [];
  const nameLower = productName.toLowerCase();
  const charCount = productName.length;

  // 1. 추가 추천: 승인된 고점수 후보 중 상품명에 없는 것
  const approvedCandidates = candidates
    .filter((c) => c.approvalStatus === 'approved')
    .sort((a, b) => b.candidateScore - a.candidateScore);

  for (const c of approvedCandidates.slice(0, 5)) {
    const kwLower = c.keyword.toLowerCase().replace(/\s+/g, '');
    const nameNoSpace = nameLower.replace(/\s+/g, '');
    if (!nameNoSpace.includes(kwLower)) {
      // 100자 제한 체크
      if (charCount + c.keyword.length + 1 <= 100) {
        recs.push({
          type: 'add',
          keyword: c.keyword,
          reason: `후보 점수 ${c.candidateScore}점, 월간 검색량 ${formatNumber(c.monthlySearchVolume)}`,
          metrics: {
            monthlySearch: c.monthlySearchVolume,
            competition: c.competitionIndex,
            score: c.candidateScore,
          },
        });
      }
    }
  }

  // 2. 제거 추천: redundant 키워드 또는 우선순위 점수가 매우 낮은 키워드
  for (const kw of mappedKeywords) {
    if (kw.keywordType === 'redundant') {
      recs.push({
        type: 'remove',
        keyword: kw.keyword,
        reason: '불필요 키워드 (검색에 도움되지 않음)',
        metrics: {
          monthlySearch: kw.monthlyTotalSearch,
          score: kw.priorityScore,
        },
      });
    } else if (kw.priorityScore <= 10 && kw.monthlyTotalSearch < 100) {
      recs.push({
        type: 'remove',
        keyword: kw.keyword,
        reason: `우선순위 점수 ${kw.priorityScore.toFixed(1)}, 검색량 매우 적음`,
        metrics: {
          monthlySearch: kw.monthlyTotalSearch,
          score: kw.priorityScore,
        },
      });
    }
  }

  // 3. 교체 추천: 동의어 키워드 중 검색량이 더 높은 후보가 있는 경우
  const synonymKeywords = mappedKeywords.filter((kw) => kw.keywordType === 'synonym');
  for (const syn of synonymKeywords) {
    const betterCandidate = approvedCandidates.find(
      (c) =>
        c.monthlySearchVolume > syn.monthlyTotalSearch * 1.5 &&
        c.candidateScore > syn.priorityScore
    );
    if (betterCandidate) {
      recs.push({
        type: 'swap',
        keyword: betterCandidate.keyword,
        swapTarget: syn.keyword,
        reason: `"${syn.keyword}" (검색량 ${formatNumber(syn.monthlyTotalSearch)})보다 "${betterCandidate.keyword}" (검색량 ${formatNumber(betterCandidate.monthlySearchVolume)})이 더 효과적`,
        metrics: {
          monthlySearch: betterCandidate.monthlySearchVolume,
          competition: betterCandidate.competitionIndex,
          score: betterCandidate.candidateScore,
        },
      });
    }
  }

  return recs;
}
