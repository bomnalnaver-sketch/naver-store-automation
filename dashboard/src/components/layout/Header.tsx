/**
 * @file Header.tsx
 * @description 상단 헤더 (모바일 네비게이션 + 다크모드 토글)
 */

'use client';

import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';
import './Header.css';

export function Header() {
  return (
    <header className="app-header">
      <div className="header-left">
        <MobileNav />
      </div>
      <div className="header-right">
        <ThemeToggle />
      </div>
    </header>
  );
}
