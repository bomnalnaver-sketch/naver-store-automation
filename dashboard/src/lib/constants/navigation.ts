/**
 * @file navigation.ts
 * @description 사이드바 네비게이션 항목 정의 (그룹화)
 */

import {
  LayoutDashboard,
  Package,
  Search,
  BarChart3,
  Megaphone,
  Brain,
  Settings,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: '메인',
    items: [
      { label: '대시보드', href: '/', icon: LayoutDashboard },
      { label: '상품 관리', href: '/products', icon: Package },
    ],
  },
  {
    label: '분석',
    items: [
      { label: '키워드 분석', href: '/keywords', icon: Search },
      { label: '후보 관리', href: '/candidates', icon: Lightbulb },
      { label: '순위 추적', href: '/rankings', icon: BarChart3 },
      { label: '광고 성과', href: '/ads', icon: Megaphone },
      { label: 'AI 분석', href: '/ai', icon: Brain },
    ],
  },
  {
    label: '시스템',
    items: [
      { label: '설정', href: '/settings', icon: Settings },
    ],
  },
];

/** 모든 네비게이션 아이템 (flat 배열) - 검색/브레드크럼용 */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
