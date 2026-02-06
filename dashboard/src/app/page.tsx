/**
 * @file page.tsx
 * @description 메인 대시보드 페이지
 */

import { Package, Search, TrendingUp, Bell } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { AlertFeed } from '@/components/dashboard/AlertFeed';
import { DailyTrendChart } from '@/components/dashboard/DailyTrendChart';
import { ApiBudgetGauge } from '@/components/dashboard/ApiBudgetGauge';
import {
  fetchDashboardKpi,
  fetchRecentAlerts,
  fetchDailyTrends,
  fetchApiBudgetStatus,
} from '@/lib/queries/dashboard';
import { formatNumber, formatPercent } from '@/lib/utils/formatters';
import './page.css';

export default async function DashboardPage() {
  const [kpi, alerts, trends, budget] = await Promise.all([
    fetchDashboardKpi(),
    fetchRecentAlerts(),
    fetchDailyTrends(),
    fetchApiBudgetStatus(),
  ]);

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-title">대시보드</h1>

      {/* KPI 카드 */}
      <div className="dashboard-kpi-grid">
        <KpiCard
          title="전체 상품"
          value={formatNumber(kpi.totalProducts)}
          description="활성 상품"
          icon={Package}
        />
        <KpiCard
          title="활성 키워드"
          value={formatNumber(kpi.activeKeywords)}
          description="추적 중"
          icon={Search}
        />
        <KpiCard
          title="7일 평균 ROAS"
          value={kpi.avgRoas7d != null ? formatPercent(kpi.avgRoas7d, 0) : '-'}
          description="최근 7일"
          icon={TrendingUp}
        />
        <KpiCard
          title="미확인 알림"
          value={formatNumber(kpi.unreadAlerts)}
          description="순위 변동"
          icon={Bell}
        />
      </div>

      {/* 차트 + 알림 */}
      <div className="dashboard-main-grid">
        <div className="dashboard-chart-area">
          <DailyTrendChart data={trends} />
          <ApiBudgetGauge budget={budget} />
        </div>
        <div className="dashboard-alert-area">
          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
