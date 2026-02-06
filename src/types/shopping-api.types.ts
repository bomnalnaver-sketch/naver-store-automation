/**
 * @file shopping-api.types.ts
 * @description 네이버 쇼핑 검색 API 타입 정의
 * @responsibilities
 * - 쇼핑 검색 요청/응답 타입
 * - 검색 결과 아이템 타입
 */

// ============================================
// 쇼핑 검색 API 요청
// ============================================

export interface ShoppingSearchParams {
  query: string;
  display?: number; // 1~100, 기본 40
  start?: number; // 1~1000
  sort?: 'sim' | 'date' | 'asc' | 'dsc';
  exclude?: string; // 예: 'used:rental:cbshop'
}

// ============================================
// 쇼핑 검색 API 응답
// ============================================

export interface ShoppingSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: ShoppingSearchItem[];
}

export interface ShoppingSearchItem {
  title: string; // HTML 태그 포함 가능 (<b> 등)
  link: string;
  image: string;
  lprice: string; // 최저가 (문자열)
  hprice: string; // 최고가 (문자열)
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}
