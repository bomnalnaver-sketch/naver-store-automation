/**
 * @file Sidebar.tsx
 * @description 좌측 사이드바 네비게이션
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants/navigation';
import { Store } from 'lucide-react';
import './Sidebar.css';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link href="/" className="sidebar-logo">
          <Store className="h-6 w-6" />
          <span className="sidebar-logo-text">스토어 자동화</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('sidebar-nav-item', isActive && 'sidebar-nav-item-active')}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <p className="text-xs text-muted-foreground">
          네이버 스마트스토어 AI
        </p>
      </div>
    </aside>
  );
}
