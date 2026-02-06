/**
 * @file page.tsx
 * @description 메인 대시보드 페이지
 */

import { Package, Search, TrendingUp, Bell } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { MetricCard } from '@/components/dashboard/MetricCard/MetricCard';
import { AlertFeed } from '@/components/dashboard/AlertFeed';
import { AreaChartCard } from '@/components/charts/AreaChartCard';
import { BudgetTracker } from '@/components/dashboard/BudgetTracker/BudgetTracker';
import {
  fetchDashboardKpi,
  fetchRecentAlerts,
  fetchDailyTrends,
  fetchApiBudgetStatus,
} from '@/lib/queries/dashboard';
import { formatNumber, formatPercent } from '@/lib/utils/formatters';
import type { ChartConfig } from '@/components/ui/chart';
import './page.css';

const trendChartConfig: ChartConfig = {
  totalSales: { label: '매출', color: 'var(--chart-1)' },
  totalCost: { label: '광고비', color: 'var(--chart-5)' },
};

export default async function DashboardPage() {
  const [kpi, alerts, trends, budget] = await Promise.all([
    fetchDashboardKpi(),
    fetchRecentAlerts(),
    fetchDailyTrends(),
    fetchApiBudgetStatus(),
  ]);

  const trendData = trends.map((d) => ({
    ...d,
    dateLabel: d.date.slice(5),
  }));

  return (
    <div className="dashboard-page">
      <PageHeader
        title="대시보드"
        description="스마트스토어 자동화 시스템 현황을 한눈에 확인합니다"
      />

      <div className="dashboard-kpi-grid">
        <MetricCard
          title="전체 상품"
          value={formatNumber(kpi.totalProducts)}
          description="활성 상품"
          icon={Package}
        />
        <MetricCard
          title="활성 키워드"
          value={formatNumber(kpi.activeKeywords)}
          description="추적 중"
          icon={Search}
        />
        <MetricCard
          title="7일 평균 ROAS"
          value={kpi.avgRoas7d != null ? formatPercent(kpi.avgRoas7d, 0) : '-'}
          description="최근 7일"
          icon={TrendingUp}
        />
        <MetricCard
          title="미확인 알림"
          value={formatNumber(kpi.unreadAlerts)}
          description="순위 변동"
          icon={Bell}
        />
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-chart-area">
          <AreaChartCard
            title="매출 / 광고비 트렌드 (30일)"
            data={trendData}
            config={trendChartConfig}
            xAxisKey="dateLabel"
            yAxisFormat="man"
          />
          <BudgetTracker budget={budget} />
        </div>
        <div className="dashboard-alert-area">
          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
