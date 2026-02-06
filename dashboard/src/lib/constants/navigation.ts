/**
 * @file navigation.ts
 * @description 사이드바 네비게이션 항목 정의
 */

import {
  LayoutDashboard,
  Package,
  Search,
  BarChart3,
  Megaphone,
  Brain,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: '대시보드', href: '/', icon: LayoutDashboard },
  { label: '상품 관리', href: '/products', icon: Package },
  { label: '키워드 분석', href: '/keywords', icon: Search },
  { label: '순위 추적', href: '/rankings', icon: BarChart3 },
  { label: '광고 성과', href: '/ads', icon: Megaphone },
  { label: 'AI 분석', href: '/ai', icon: Brain },
  { label: '설정', href: '/settings', icon: Settings },
];
