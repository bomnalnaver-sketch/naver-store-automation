/**
 * @file db.types.ts
 * @description 데이터베이스 테이블 타입 정의
 * @responsibilities
 * - 주요 테이블 타입 정의
 */

/**
 * 상품 정보
 */
export interface Product {
  id: number;
  naverProductId: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  tags?: string[];
  price?: number;
  representativeKeyword?: string;
  representativeKeywordRank?: number | null;
  isActive: boolean;
}
