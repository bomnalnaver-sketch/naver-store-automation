/**
 * @file Header.tsx
 * @description 상단 헤더 (사이드바 트리거 + 브레드크럼 + 검색 + 테마 토글)
 */

'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from './ThemeToggle';
import { DynamicBreadcrumb } from './DynamicBreadcrumb/DynamicBreadcrumb';
import { SearchCommand } from './SearchCommand/SearchCommand';
import './Header.css';

export function Header() {
  return (
    <header className="app-header">
      <div className="header-left">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 !h-4" />
        <DynamicBreadcrumb />
      </div>
      <div className="header-right">
        <SearchCommand />
        <ThemeToggle />
      </div>
    </header>
  );
}
