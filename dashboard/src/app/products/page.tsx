/**
 * @file page.tsx
 * @description 상품 리스트 페이지
 */

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader/PageHeader';
import { ProductsTableClient } from '@/components/products/ProductsTableClient';
import { fetchProducts } from '@/lib/queries/products';
import './page.css';

export default async function ProductsPage() {
  const products = await fetchProducts();

  return (
    <div className="products-page">
      <PageHeader
        title="상품 관리"
        description={`총 ${products.length}개 활성 상품`}
      />

      <Card>
        <CardContent className="pt-6">
          <ProductsTableClient data={products} />
        </CardContent>
      </Card>
    </div>
  );
}
