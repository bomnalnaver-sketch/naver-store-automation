/**
 * @file ProductList.tsx
 * @description 상품별 후보 키워드 요약 리스트
 */

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Package } from 'lucide-react';
import type { ProductCandidateSummary } from '@/lib/queries/candidates';
import { formatNumber } from '@/lib/utils/formatters';
import './ProductList.css';

interface ProductListProps {
  products: ProductCandidateSummary[];
}

export function ProductList({ products }: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium mb-2">후보 키워드가 있는 상품이 없습니다</p>
        <p className="text-sm">키워드 발굴을 실행하면 상품별로 후보가 생성됩니다.</p>
      </div>
    );
  }

  return (
    <div className="product-list">
      {products.map((product) => (
        <Link
          key={product.productId}
          href={`/candidates?productId=${product.productId}`}
          className="product-list-link"
        >
          <Card className="product-list-item">
            <div className="product-list-icon">
              <Package className="w-5 h-5" />
            </div>
            <div className="product-list-info">
              <p className="product-list-name">{product.productName}</p>
              <div className="product-list-counts">
                {product.pendingCount > 0 && (
                  <Badge variant="secondary" className="product-list-badge-pending">
                    대기 {formatNumber(product.pendingCount)}
                  </Badge>
                )}
                {product.approvedCount > 0 && (
                  <Badge variant="secondary" className="product-list-badge-approved">
                    승인 {formatNumber(product.approvedCount)}
                  </Badge>
                )}
                {product.rejectedCount > 0 && (
                  <Badge variant="secondary" className="product-list-badge-rejected">
                    거부 {formatNumber(product.rejectedCount)}
                  </Badge>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </Card>
        </Link>
      ))}
    </div>
  );
}
