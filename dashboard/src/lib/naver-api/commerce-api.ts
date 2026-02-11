/**
 * @file commerce-api.ts
 * @description 대시보드용 네이버 커머스 API 클라이언트
 * - OAuth2 토큰 발급 후 API 호출 (2단계 인증)
 * - POST /v1/products/search 엔드포인트 사용
 */

import bcrypt from 'bcryptjs';

/** Commerce API 상품 (응답 구조에 맞게 수정) */
export interface CommerceProduct {
  id: string; // channelProductNo
  originProductNo: number;
  name: string;
  salePrice: number;
  stockQuantity: number;
  statusType: 'SALE' | 'SOLD_OUT' | 'SUSPENSION' | 'WAIT' | 'UNADMISSION' | 'DELETION';
  category?: {
    id: string;
    name: string;
  };
}

/** API 응답 구조 */
interface ProductSearchResponse {
  contents: Array<{
    originProductNo: number;
    channelProducts: Array<{
      originProductNo: number;
      channelProductNo: number;
      name: string;
      statusType: string;
      salePrice: number;
      stockQuantity: number;
    }>;
  }>;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const COMMERCE_API_URL = 'https://api.commerce.naver.com/external';

// 토큰 캐시 (만료 시간 전까지 재사용)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * bcrypt 서명 생성
 */
function generateSignature(clientId: string, clientSecret: string, timestamp: number): string {
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  return Buffer.from(hashed, 'utf-8').toString('base64');
}

/**
 * OAuth2 Access Token 발급
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.NAVER_COMMERCE_CLIENT_ID;
  const clientSecret = process.env.NAVER_COMMERCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Commerce API 자격 증명이 설정되지 않았습니다');
  }

  // 캐시된 토큰이 유효하면 재사용
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const timestamp = Date.now();
  const signature = generateSignature(clientId, clientSecret, timestamp);

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('timestamp', timestamp.toString());
  params.append('client_secret_sign', signature);
  params.append('type', 'SELF');

  const response = await fetch(`${COMMERCE_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('토큰 발급 실패:', response.status, errorText);
    throw new Error(`토큰 발급 실패: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // 토큰 캐시 (만료 5분 전까지 유효)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  console.log('OAuth2 토큰 발급 성공');
  return data.access_token;
}

/**
 * 상품 목록 검색 (POST /v1/products/search)
 */
export async function searchProducts(params?: {
  page?: number;
  size?: number;
}): Promise<CommerceProduct[]> {
  const accessToken = await getAccessToken();
  const url = `${COMMERCE_API_URL}/v1/products/search?page=${params?.page || 1}&size=${params?.size || 100}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}), // 빈 객체 = 전체 조회
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Commerce API 응답 오류:', response.status, errorText);
    throw new Error(`Commerce API 오류: ${response.status} - ${errorText}`);
  }

  const data: ProductSearchResponse = await response.json();

  // 응답 구조 변환: contents -> CommerceProduct[]
  const products: CommerceProduct[] = [];
  for (const item of data.contents || []) {
    for (const channelProduct of item.channelProducts || []) {
      products.push({
        id: channelProduct.channelProductNo.toString(),
        originProductNo: channelProduct.originProductNo,
        name: channelProduct.name,
        salePrice: channelProduct.salePrice,
        stockQuantity: channelProduct.stockQuantity,
        statusType: channelProduct.statusType as CommerceProduct['statusType'],
      });
    }
  }

  return products;
}

/**
 * 모든 상품 조회 (페이징 처리)
 */
export async function getAllProducts(): Promise<CommerceProduct[]> {
  const allProducts: CommerceProduct[] = [];
  let page = 1;
  const size = 100;

  while (true) {
    const products = await searchProducts({ page, size });

    if (products.length === 0) break;

    allProducts.push(...products);

    if (products.length < size) break;

    page++;

    // Rate limit 준수 (초당 2회)
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return allProducts;
}

// 하위 호환성을 위한 alias
export const getProducts = searchProducts;
