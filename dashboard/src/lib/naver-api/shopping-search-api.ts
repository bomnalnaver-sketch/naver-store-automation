/**
 * @file shopping-search-api.ts
 * @description 대시보드용 네이버 쇼핑 검색 API 클라이언트
 * @responsibilities
 * - 키워드 검색으로 상품 순위 조회
 * - 페이지네이션 검색 (최대 1000위까지)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 루트 프로젝트의 .env 파일 로드
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const SHOPPING_API_BASE = 'https://openapi.naver.com';

interface ShoppingSearchItem {
  productId: string;
  title: string;
  link: string;
  mallName: string;
  [key: string]: unknown;
}

interface ShoppingSearchResponse {
  total: number;
  start: number;
  display: number;
  items: ShoppingSearchItem[];
}

function getAuthHeaders(): Record<string, string> {
  const clientId = process.env.NAVER_SHOPPING_CLIENT_ID;
  const clientSecret = process.env.NAVER_SHOPPING_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('네이버 쇼핑 검색 API 자격 증명이 설정되지 않았습니다');
  }

  return {
    'X-Naver-Client-Id': clientId,
    'X-Naver-Client-Secret': clientSecret,
  };
}

/**
 * 키워드로 쇼핑 검색 (페이지 단위)
 */
export async function searchShopping(
  keyword: string,
  start: number = 1,
  display: number = 100
): Promise<ShoppingSearchResponse> {
  const headers = getAuthHeaders();
  const params = new URLSearchParams({
    query: keyword,
    display: display.toString(),
    start: start.toString(),
    sort: 'sim',
    exclude: 'used:rental:cbshop',
  });

  const response = await fetch(
    `${SHOPPING_API_BASE}/v1/search/shop.json?${params}`,
    { headers }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`쇼핑 검색 API 오류: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * 상품의 키워드 순위 조회 (최대 1000위)
 * @returns 순위 (1~1000) 또는 null (1000위 밖)
 */
export async function getProductRank(
  keyword: string,
  shoppingProductId: string
): Promise<{ rank: number | null; apiCalls: number }> {
  const DISPLAY = 100;
  const MAX_RANK = 1000;
  let apiCalls = 0;

  for (let start = 1; start <= MAX_RANK; start += DISPLAY) {
    const response = await searchShopping(keyword, start, DISPLAY);
    apiCalls++;

    const index = response.items.findIndex(
      (item) => item.productId === shoppingProductId
    );

    if (index !== -1) {
      return { rank: start + index, apiCalls };
    }

    // 결과가 없거나 마지막 페이지면 종료
    if (response.items.length < DISPLAY) break;

    // Rate limit (100ms 간격)
    await new Promise((r) => setTimeout(r, 100));
  }

  return { rank: null, apiCalls };
}
