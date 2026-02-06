/**
 * @file BudgetTracker.tsx
 * @description API 예산 사용 현황 (Progress 바 기반)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatNumber } from '@/lib/utils/formatters';
import type { ApiBudgetStatus } from '@/lib/queries/dashboard';
import './BudgetTracker.css';

interface BudgetTrackerProps {
  budget: ApiBudgetStatus;
}

export function BudgetTracker({ budget }: BudgetTrackerProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">API 예산 현황</CardTitle>
      </CardHeader>
      <CardContent className="budget-tracker-content">
        <BudgetItem label="전체" used={budget.total.used} limit={budget.total.limit} />
        <BudgetItem label="순위 추적" used={budget.ranking.used} limit={budget.ranking.limit} />
        <BudgetItem label="색깔 분류" used={budget.colorAnalysis.used} limit={budget.colorAnalysis.limit} />
      </CardContent>
    </Card>
  );
}

function BudgetItem({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="budget-item">
      <div className="budget-item-header">
        <span className="budget-item-label">{label}</span>
        <span className="budget-item-value">
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
      </div>
      <Progress
        value={percent}
        className={`budget-item-bar ${percent >= 90 ? 'budget-danger' : percent >= 70 ? 'budget-warning' : ''}`}
      />
    </div>
  );
}
