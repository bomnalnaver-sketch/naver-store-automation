/**
 * @file KpiCard.tsx
 * @description KPI 카드 컴포넌트 (메인 대시보드용)
 */

import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import './KpiCard.css';

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function KpiCard({ title, value, description, icon: Icon, trend }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="kpi-card-content">
        <div className="kpi-card-header">
          <p className="kpi-card-title">{title}</p>
          <Icon className="kpi-card-icon" />
        </div>
        <div className="kpi-card-value">{value}</div>
        {(description || trend) && (
          <p className="kpi-card-description">
            {trend && (
              <span className={trend.isPositive ? 'kpi-trend-positive' : 'kpi-trend-negative'}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
            {description && <span> {description}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
