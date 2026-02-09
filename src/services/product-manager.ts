/**
 * @file product-manager.ts
 * @description 상품 관리 서비스
 * @responsibilities
 * - 네이버 쇼핑 ID 일괄 업데이트
 * - 상품 정보 조회 및 관리
 */

import { db } from '@/db/client';
import { shoppingSearchApi } from '@/services/naver-api/shopping-search-api';
import { logger } from '@/utils/logger';

/** 쇼핑 ID 업데이트 결과 */
export interface ShoppingIdUpdateResult {
  total: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * 네이버 쇼핑 ID가 없는 상품들의 ID를 일괄 조회 및 업데이트
 */
export async function batchUpdateShoppingIds(): Promise<ShoppingIdUpdateResult> {
  const result: ShoppingIdUpdateResult = {
    total: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 쇼핑 ID가 없는 상품 조회
    const productsResult = await db.query(`
      SELECT id, naver_product_id, product_name, store_name
      FROM products
      WHERE naver_shopping_product_id IS NULL
        AND excluded_from_test = false
      ORDER BY id
      LIMIT 10
    `);

    const products = productsResult.rows;
    result.total = products.length;

    if (products.length === 0) {
      logger.debug('쇼핑 ID 업데이트 대상 없음');
      return result;
    }

    logger.info(`쇼핑 ID 업데이트 대상: ${products.length}개 상품`);

    for (const product of products) {
      try {
        const shoppingId = await findShoppingProductId(
          product.product_name,
          product.store_name || '스마트스토어'
        );

        if (shoppingId) {
          await db.query(
            `UPDATE products SET naver_shopping_product_id = $1, updated_at = NOW() WHERE id = $2`,
            [shoppingId, product.id]
          );
          result.updated++;
          logger.debug(`상품 ${product.id}: 쇼핑 ID ${shoppingId} 저장`);
        } else {
          logger.debug(`상품 ${product.id}: 쇼핑 ID 못 찾음`);
        }

        // Rate limit 준수
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (err: any) {
        result.failed++;
        result.errors.push(`${product.id}: ${err.message}`);
        logger.error(`상품 ${product.id} 쇼핑 ID 조회 실패: ${err.message}`);
      }
    }

    logger.info('쇼핑 ID 일괄 업데이트 완료', {
      total: result.total,
      updated: result.updated,
      failed: result.failed,
    });

    return result;
  } catch (error: any) {
    logger.error('쇼핑 ID 일괄 업데이트 실패', { error: error.message });
    result.errors.push(error.message);
    return result;
  }
}

/**
 * 네이버 쇼핑 검색으로 상품 ID 조회 (외부 export용)
 * @param productName 상품명
 * @param searchKeyword 검색 키워드 (선택, 기본값: 상품명)
 */
export async function findNaverShoppingProductId(
  productName: string,
  searchKeyword?: string
): Promise<string | null> {
  const keyword = searchKeyword || productName;
  return findShoppingProductId(keyword, '스마트스토어');
}

/**
 * 네이버 쇼핑 검색으로 상품 ID 조회 (내부용)
 */
async function findShoppingProductId(productName: string, storeName: string): Promise<string | null> {
  try {
    const items = await shoppingSearchApi.searchTop40(productName);
    if (items.length === 0) return null;

    // 상품명 정규화
    const normalize = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedName = normalize(productName);

    // 1. 정확한 상품명 매칭
    const exactMatch = items.find((item) => normalize(item.title) === normalizedName);
    if (exactMatch) return exactMatch.productId;

    // 2. 스토어명 + 부분 매칭
    const storeMatch = items.find((item) =>
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
    logger.debug(`쇼핑 검색 실패: ${error.message}`);
    return null;
  }
}

/**
 * 상품 ID로 상품 정보 조회
 */
export async function getProductById(productId: number) {
  const result = await db.query(
    `SELECT * FROM products WHERE id = $1`,
    [productId]
  );
  return result.rows[0] || null;
}

/**
 * 네이버 상품 ID로 상품 정보 조회
 */
export async function getProductByNaverId(naverProductId: string) {
  const result = await db.query(
    `SELECT * FROM products WHERE naver_product_id = $1`,
    [naverProductId]
  );
  return result.rows[0] || null;
}
