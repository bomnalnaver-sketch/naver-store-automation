/**
 * @file KeywordImproveTabs.tsx
 * @description 키워드 개선 탭 컨테이너
 * @responsibilities
 * - 4개 탭 전환 관리 (후보관리, 순서관리, 키워드변경 추천, 상품명 제작)
 * - 각 탭 컨텐츠 렌더링
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { CandidateTab } from './CandidateTab';
import { ReorderTab } from './ReorderTab';
import { RecommendTab } from './RecommendTab';
import { ProductNameBuilderTab } from './ProductNameBuilderTab';
import type { MappedKeywordWithMetrics, CandidateKeywordForImprove } from '@/lib/queries/keyword-improve';

interface KeywordImproveTabsProps {
  productId: number;
  productName: string;
  mappedKeywords: MappedKeywordWithMetrics[];
  candidates: CandidateKeywordForImprove[];
}

const TABS = [
  { id: 'candidates', label: '후보관리' },
  { id: 'reorder', label: '순서관리' },
  { id: 'recommend', label: '키워드변경 추천' },
  { id: 'builder', label: '상품명 제작' },
] as const;

type TabId = typeof TABS[number]['id'];

export function KeywordImproveTabs({
  productId,
  productName,
  mappedKeywords,
  candidates,
}: KeywordImproveTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('candidates');

  return (
    <Card className="ki-tabs-container">
      <div className="ki-tabs-list">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className="ki-tab-trigger"
            data-active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ki-tab-content" style={{ padding: '24px 20px' }}>
        {activeTab === 'candidates' && (
          <CandidateTab
            productId={productId}
            candidates={candidates}
            mappedKeywords={mappedKeywords}
          />
        )}
        {activeTab === 'reorder' && (
          <ReorderTab
            productId={productId}
            productName={productName}
            mappedKeywords={mappedKeywords}
          />
        )}
        {activeTab === 'recommend' && (
          <RecommendTab
            productId={productId}
            productName={productName}
            mappedKeywords={mappedKeywords}
            candidates={candidates}
          />
        )}
        {activeTab === 'builder' && (
          <ProductNameBuilderTab
            productId={productId}
            productName={productName}
            mappedKeywords={mappedKeywords}
            candidates={candidates}
          />
        )}
      </div>
    </Card>
  );
}
