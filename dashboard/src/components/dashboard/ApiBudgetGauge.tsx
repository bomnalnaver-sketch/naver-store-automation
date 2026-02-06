/**
 * @file ApiBudgetGauge.tsx
 * @description API 예산 사용 현황 게이지
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/formatters';
import type { ApiBudgetStatus } from '@/lib/queries/dashboard';
import './ApiBudgetGauge.css';

interface ApiBudgetGaugeProps {
  budget: ApiBudgetStatus;
}

export function ApiBudgetGauge({ budget }: ApiBudgetGaugeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API 예산 현황</CardTitle>
      </CardHeader>
      <CardContent className="api-budget-content">
        <BudgetBar label="전체" used={budget.total.used} limit={budget.total.limit} />
        <BudgetBar label="순위 추적" used={budget.ranking.used} limit={budget.ranking.limit} />
        <BudgetBar label="색깔 분류" used={budget.colorAnalysis.used} limit={budget.colorAnalysis.limit} />
      </CardContent>
    </Card>
  );
}

function BudgetBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const colorClass = percent >= 90 ? 'budget-bar-danger' : percent >= 70 ? 'budget-bar-warning' : 'budget-bar-ok';

  return (
    <div className="budget-bar-wrapper">
      <div className="budget-bar-header">
        <span className="budget-bar-label">{label}</span>
        <span className="budget-bar-value">
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </div>
      <div className="budget-bar-track">
        <div
          className={`budget-bar-fill ${colorClass}`}
          style={{ width: `${percent}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
