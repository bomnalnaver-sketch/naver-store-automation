/**
 * @file AppSidebar.tsx
 * @description shadcn Sidebar 기반 메인 사이드바
 * @responsibilities
 * - 그룹화된 네비게이션 표시
 * - 접기/펼치기 (icon 모드)
 * - 모바일 시트 자동 전환
 */

'use client';

import { Store } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/constants/navigation';
import { NavMain } from './NavMain';
import { NavUser } from './NavUser';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import './AppSidebar.css';

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="스토어 자동화">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">스토어 자동화</span>
                <span className="truncate text-xs text-muted-foreground">대시보드</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={NAV_GROUPS} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
