/**
 * @file fetch-products.ts
 * @description 네이버 커머스 API로 상품 및 주간 판매량 동기화
 * @responsibilities
 * - 상품 목록 조회 및 DB 동기화
 * - 대표 키워드 추출 및 네이버 쇼핑 ID 자동 조회
 * - 최근 7일 주문 조회 및 상품별 판매량 집계
 */

import 'dotenv/config';
import { Pool } from 'pg';
import axios from 'axios';
import bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 커머스 API 인증 정보
const CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID!;
const CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET!;
const API_BASE = 'https://api.commerce.naver.com/external';

// 쇼핑 검색 API 인증 정보
const SHOPPING_CLIENT_ID = process.env.NAVER_SHOPPING_CLIENT_ID!;
const SHOPPING_CLIENT_SECRET = process.env.NAVER_SHOPPING_CLIENT_SECRET!;

console.log('=== 네이버 커머스 API (bcrypt 방식) ===\n');
console.log('COMMERCE_CLIENT_ID:', CLIENT_ID);
console.log('SHOPPING_CLIENT_ID:', SHOPPING_CLIENT_ID);
console.log('');

// bcrypt 방식 서명 생성
function generateSignature(clientId: string, clientSecret: string, timestamp: number): string {
  // 1. password = client_id + "_" + timestamp
  const password = `${clientId}_${timestamp}`;
  console.log('password:', password);

  // 2. bcrypt 해싱 (client_secret을 salt로 사용)
  const hashed = bcrypt.hashSync(password, clientSecret);
  console.log('hashed:', hashed);

  // 3. Base64 인코딩
  const signature = Buffer.from(hashed, 'utf-8').toString('base64');
  console.log('signature:', signature);

  return signature;
}

async function getAccessToken(): Promise<string | null> {
  const timestamp = Date.now();
  console.log('timestamp:', timestamp);
  console.log('');

  const signature = generateSignature(CLIENT_ID, CLIENT_SECRET, timestamp);

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('timestamp', timestamp.toString());
  params.append('client_secret_sign', signature);
  params.append('type', 'SELF');

  console.log('\n요청 파라미터:');
  console.log('  grant_type:', 'client_credentials');
  console.log('  client_id:', CLIENT_ID);
  console.log('  timestamp:', timestamp);
  console.log('  client_secret_sign:', signature);
  console.log('  type:', 'SELF');

  try {
    const response = await axios.post(
      'https://api.commerce.naver.com/external/v1/oauth2/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('\n✅ 토큰 발급 성공!');
    console.log('access_token:', response.data.access_token?.substring(0, 50) + '...');
    return response.data.access_token;
  } catch (error: any) {
    console.log('\n❌ 토큰 발급 실패');
    console.log('에러:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

async function fetchProducts(accessToken: string) {
  // POST /v1/products/search 엔드포인트 사용
  try {
    console.log('  POST /v1/products/search 호출...');
    const response = await axios.post(
      `${API_BASE}/v1/products/search`,
      {
        // 검색 조건 (빈 객체면 전체 조회)
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          page: 1,
          size: 100
        },
      }
    );
    console.log('  ✓ 상품 조회 성공');
    console.log('  응답:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.log('  ✗ 상품 조회 실패');
    console.log('  에러 코드:', error.response?.data?.code);
    console.log('  에러 메시지:', error.response?.data?.message);
    console.log('  상세:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

/**
 * 최근 7일 주문 조회
 */
async function fetchWeeklyOrders(accessToken: string): Promise<any[]> {
  const allOrders: any[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 날짜 포맷: YYYY-MM-DDTHH:mm:ss.sss+09:00
  const formatDate = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000+09:00`;
  };

  try {
    console.log('\n최근 7일 주문 조회 중...');
    console.log(`  기간: ${formatDate(weekAgo)} ~ ${formatDate(now)}`);

    // 페이징 처리
    let lastChangedFrom = formatDate(weekAgo);
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get(
        `${API_BASE}/v1/pay-order/seller/product-orders/last-changed-statuses`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            lastChangedFrom,
            limitCount: 300, // 최대 300건
          },
        }
      );

      const data = response.data;

      if (data.lastChangeStatuses && data.lastChangeStatuses.length > 0) {
        allOrders.push(...data.lastChangeStatuses);
        console.log(`  조회된 주문: ${data.lastChangeStatuses.length}건 (누적: ${allOrders.length}건)`);

        // 다음 페이지가 있으면 마지막 변경시간 + 1ms로 계속
        if (data.moreSequence) {
          lastChangedFrom = data.moreSequence;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Rate limit 준수 (초당 2회)
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    console.log(`  ✓ 총 ${allOrders.length}건 주문 조회 완료`);
    return allOrders;
  } catch (error: any) {
    console.log('  ✗ 주문 조회 실패');
    console.log('  에러 코드:', error.response?.data?.code);
    console.log('  에러 메시지:', error.response?.data?.message);
    return [];
  }
}

/**
 * 상품별 주간 판매량 집계
 */
function aggregateWeeklySales(orders: any[]): Map<string, { orders: number; sales: number }> {
  const productSales = new Map<string, { orders: number; sales: number }>();

  for (const order of orders) {
    // 결제완료된 주문만 집계 (취소/반품 제외)
    const validStatuses = ['PAYED', 'DELIVERING', 'DELIVERED', 'PURCHASE_DECIDED'];
    if (!validStatuses.includes(order.productOrderStatus)) continue;

    const productId = order.productNo?.toString();
    if (!productId) continue;

    const current = productSales.get(productId) || { orders: 0, sales: 0 };
    current.orders += 1;
    current.sales += order.totalPaymentAmount || 0;
    productSales.set(productId, current);
  }

  return productSales;
}

/**
 * 네이버 쇼핑 검색으로 상품 ID 조회
 */
async function findNaverShoppingProductId(
  productName: string,
  keyword: string,
  storeName: string
): Promise<string | null> {
  if (!SHOPPING_CLIENT_ID || !SHOPPING_CLIENT_SECRET) {
    console.log('    쇼핑 API 인증 정보 없음, 건너뜀');
    return null;
  }

  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/shop.json', {
      headers: {
        'X-Naver-Client-Id': SHOPPING_CLIENT_ID,
        'X-Naver-Client-Secret': SHOPPING_CLIENT_SECRET,
      },
      params: {
        query: keyword,
        display: 40,
        start: 1,
        sort: 'sim',
        exclude: 'used:rental:cbshop',
      },
    });

    const items = response.data.items || [];
    if (items.length === 0) return null;

    // 상품명 정규화 함수
    const normalize = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedName = normalize(productName);

    // 1. 정확한 상품명 매칭
    const exactMatch = items.find((item: any) => normalize(item.title) === normalizedName);
    if (exactMatch) return exactMatch.productId;

    // 2. 스토어명 + 부분 매칭
    const storeMatch = items.find((item: any) =>
      item.mallName === storeName &&
      normalize(item.title).includes(normalizedName.substring(0, 20))
    );
    if (storeMatch) return storeMatch.productId;

    // 3. 유사도 매칭 (70% 이상)
    for (const item of items) {
      const itemWords = new Set(normalize(item.title).split(/\s+/));
      const nameWords = new Set(normalizedName.split(/\s+/));
      const intersection = [...itemWords].filter(x => nameWords.has(x)).length;
      const union = new Set([...itemWords, ...nameWords]).size;
      if (intersection / union >= 0.7) return item.productId;
    }

    return null;
  } catch (error: any) {
    console.log(`    쇼핑 검색 실패: ${error.message}`);
    return null;
  }
}

/**
 * DB에 주간 판매량 업데이트
 */
async function updateWeeklySales(productSales: Map<string, { orders: number; sales: number }>) {
  console.log('\n주간 판매량 DB 업데이트 중...');

  let updated = 0;
  for (const [productId, stats] of productSales) {
    try {
      const result = await pool.query(`
        UPDATE products
        SET weekly_orders = $1,
            weekly_sales = $2,
            weekly_sales_updated_at = NOW()
        WHERE naver_product_id = $3
      `, [stats.orders, stats.sales, productId]);

      if (result.rowCount && result.rowCount > 0) {
        updated++;
        console.log(`  ✓ 상품 ${productId}: 주문 ${stats.orders}건, 매출 ${stats.sales.toLocaleString()}원`);
      }
    } catch (err: any) {
      console.error(`  ✗ 상품 ${productId} 업데이트 실패:`, err.message);
    }
  }

  console.log(`  총 ${updated}개 상품 판매량 업데이트 완료`);
}

async function main() {
  // 1. 토큰 발급
  const accessToken = await getAccessToken();
  if (!accessToken) {
    await pool.end();
    return;
  }

  // 2. 상품 조회
  console.log('\n상품 목록 조회 중...');
  const result = await fetchProducts(accessToken);

  const storeName = '스마트스토어'; // 실제 스토어명으로 변경 필요

  if (result?.contents?.length > 0) {
    console.log(`\n상품 ${result.contents.length}개 발견`);

    for (const item of result.contents) {
      // channelProducts 배열에서 상품 정보 추출
      const channelProduct = item.channelProducts?.[0];
      if (!channelProduct) {
        console.log(`  ✗ originProductNo ${item.originProductNo}: channelProducts 없음`);
        continue;
      }

      const productName = channelProduct.name;
      const productId = item.originProductNo?.toString();
      const categoryId = channelProduct.categoryId?.toString() || null;
      const categoryName = channelProduct.wholeCategoryName || null;

      try {
        // 1. 상품 기본 정보 저장 (카테고리 포함)
        await pool.query(`
          INSERT INTO products (naver_product_id, product_name, store_name, category_id, category_name)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (naver_product_id) DO UPDATE SET
            product_name = EXCLUDED.product_name,
            category_id = EXCLUDED.category_id,
            category_name = EXCLUDED.category_name,
            updated_at = NOW()
        `, [productId, productName, storeName, categoryId, categoryName]);
        console.log(`  ✓ ${productName} [카테고리: ${categoryName || '없음'}]`);

        // 2. naver_shopping_product_id가 없으면 쇼핑 검색으로 찾기
        const existing = await pool.query(
          `SELECT naver_shopping_product_id FROM products WHERE naver_product_id = $1`,
          [productId]
        );

        if (!existing.rows[0]?.naver_shopping_product_id) {
          console.log(`    쇼핑 ID 조회 중...`);
          const shoppingId = await findNaverShoppingProductId(productName, productName, storeName);

          if (shoppingId) {
            await pool.query(
              `UPDATE products SET naver_shopping_product_id = $1 WHERE naver_product_id = $2`,
              [shoppingId, productId]
            );
            console.log(`    ✓ 쇼핑 ID 발견: ${shoppingId}`);
          } else {
            console.log(`    ✗ 쇼핑 ID 못 찾음`);
          }

          // Rate limit 준수 (초당 2회)
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      } catch (err: any) {
        console.error(`  ✗ ${productName}:`, err.message);
      }
    }
  } else {
    console.log('\n상품이 없거나 조회 실패');
  }

  // 3. 주간 판매량 조회 및 업데이트
  const orders = await fetchWeeklyOrders(accessToken);
  if (orders.length > 0) {
    const productSales = aggregateWeeklySales(orders);
    await updateWeeklySales(productSales);
  }

  // 결과 확인
  const products = await pool.query(`
    SELECT id, naver_product_id, product_name, weekly_orders, weekly_sales
    FROM products
    WHERE excluded_from_test = false
    ORDER BY weekly_orders DESC NULLS LAST
  `);
  console.log('\n=== 등록된 상품 (주간 판매량 순) ===');
  products.rows.forEach(row => {
    const orders = row.weekly_orders || 0;
    const sales = row.weekly_sales || 0;
    console.log(`  [${row.id}] ${row.product_name} - 주문 ${orders}건, 매출 ${sales.toLocaleString()}원`);
  });

  await pool.end();
}

main().catch(console.error);
