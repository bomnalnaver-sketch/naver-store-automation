/**
 * @file PageHeader.tsx
 * @description 페이지 제목 + 설명 + 액션 버튼 공통 컴포넌트
 */

import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
        {description && (
          <p className="page-header-description">{description}</p>
        )}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
