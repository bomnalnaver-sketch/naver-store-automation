/**
 * @file MetricCard.tsx
 * @description 다채로운 그라데이션 KPI 메트릭 카드
 */

import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './MetricCard.css';

export type MetricCardVariant = 'blue' | 'purple' | 'orange' | 'teal' | 'pink' | 'green' | 'amber' | 'indigo' | 'coral' | 'sky';

interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  variant?: MetricCardVariant;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function MetricCard({ title, value, description, icon: Icon, variant = 'blue', trend }: MetricCardProps) {
  return (
    <Card className={`metric-card metric-card-${variant}`}>
      <CardContent className="metric-card-content">
        <div className="metric-card-icon-wrapper">
          <Icon className="metric-card-icon" />
        </div>
        <div className="metric-card-body">
          <p className="metric-card-title">{title}</p>
          <div className="metric-card-value">{value}</div>
          <div className="metric-card-bottom">
            {trend && (
              <span className={`metric-card-trend ${trend.isPositive ? 'trend-positive' : 'trend-negative'}`}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : trend.value === 0 ? (
                  <Minus className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              </span>
            )}
            {description && (
              <span className="metric-card-desc">{description}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
