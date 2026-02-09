/**
 * @file BudgetTracker.tsx
 * @description API 예산 사용 현황 (컬러풀한 Progress 바)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Search, Palette } from 'lucide-react';
import { formatNumber } from '@/lib/utils/formatters';
import type { ApiBudgetStatus } from '@/lib/queries/dashboard';
import './BudgetTracker.css';

interface BudgetTrackerProps {
  budget: ApiBudgetStatus;
}

export function BudgetTracker({ budget }: BudgetTrackerProps) {
  return (
    <Card className="budget-tracker-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">API 예산 현황</CardTitle>
      </CardHeader>
      <CardContent className="budget-tracker-content">
        <BudgetItem
          label="전체"
          used={budget.total.used}
          limit={budget.total.limit}
          variant="indigo"
          icon={Zap}
        />
        <BudgetItem
          label="순위 추적"
          used={budget.ranking.used}
          limit={budget.ranking.limit}
          variant="sky"
          icon={Search}
        />
        <BudgetItem
          label="색깔 분류"
          used={budget.colorAnalysis.used}
          limit={budget.colorAnalysis.limit}
          variant="amber"
          icon={Palette}
        />
      </CardContent>
    </Card>
  );
}

type BudgetVariant = 'indigo' | 'sky' | 'amber' | 'green' | 'coral';

interface BudgetItemProps {
  label: string;
  used: number;
  limit: number;
  variant: BudgetVariant;
  icon: React.ComponentType<{ className?: string }>;
}

function BudgetItem({ label, used, limit, variant, icon: Icon }: BudgetItemProps) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isDanger = percent >= 90;
  const isWarning = percent >= 70 && percent < 90;

  return (
    <div className={`budget-item budget-item-${variant}`}>
      <div className="budget-item-header">
        <div className="budget-item-left">
          <div className={`budget-item-icon budget-icon-${variant}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="budget-item-label">{label}</span>
        </div>
        <span className="budget-item-value">
          <span className="budget-used">{formatNumber(used)}</span>
          <span className="budget-separator">/</span>
          <span className="budget-limit">{formatNumber(limit)}</span>
        </span>
      </div>
      <div className="budget-bar-track">
        <div
          className={`budget-bar-fill budget-bar-${variant} ${isDanger ? 'budget-danger' : isWarning ? 'budget-warning' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="budget-percent">{percent.toFixed(1)}% 사용</div>
    </div>
  );
}
