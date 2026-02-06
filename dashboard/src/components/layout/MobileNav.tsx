/**
 * @file MobileNav.tsx
 * @description 모바일 햄버거 메뉴 (Sheet 활용)
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants/navigation';
import './MobileNav.css';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="mobile-nav-trigger">
          <Menu className="h-5 w-5" />
          <span className="sr-only">메뉴</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="mobile-nav-content">
        <div className="mobile-nav-header">
          <Store className="h-6 w-6" />
          <span className="font-bold">스토어 자동화</span>
        </div>
        <nav className="mobile-nav-list">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn('mobile-nav-item', isActive && 'mobile-nav-item-active')}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
