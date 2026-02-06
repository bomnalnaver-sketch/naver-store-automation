/**
 * @file DynamicBreadcrumb.tsx
 * @description pathname 기반 자동 브레드크럼 생성
 */

'use client';

import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { NAV_ITEMS } from '@/lib/constants/navigation';
import { Fragment } from 'react';

/** pathname에서 브레드크럼 경로 세그먼트 생성 */
function buildBreadcrumbs(pathname: string) {
  if (pathname === '/') {
    return [{ label: '대시보드', href: '/' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  let path = '';
  for (const segment of segments) {
    path += `/${segment}`;
    const navItem = NAV_ITEMS.find((item) => item.href === path);
    crumbs.push({
      label: navItem?.label ?? decodeURIComponent(segment),
      href: path,
    });
  }

  return crumbs;
}

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  if (crumbs.length <= 1) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{crumbs[0]?.label ?? '대시보드'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {index === crumbs.length - 1 ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
