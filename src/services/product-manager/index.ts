/**
 * @file index.ts
 * @description 상품 관리 서비스
 * @responsibilities
 * - 상품 등록 시 네이버 쇼핑 상품 ID 자동 조회
 * - 상품 정보 업데이트
 */

import { db } from '@/db/client';
import { shoppingSearchApi } from '@/services/naver-api/shopping-search-api';
import { logger } from '@/utils/logger';

/** 상품 등록 입력 */
interface ProductInput {
  naverProductId: string; // 스마트스토어 상품 ID
  productName: string;
  representativeKeyword: string;
  categoryId?: string;
  mallName?: string; // 스토어 이름 (매칭용)
}

/** 상품 등록 결과 */
interface ProductRegistrationResult {
  success: boolean;
  productId?: number;
  naverShoppingProductId?: string;
  error?: string;
}

/**
 * 네이버 쇼핑에서 상품 ID 자동 조회
 * 대표 키워드로 검색 후 상품명 또는 스토어명으로 매칭
 */
export async function findNaverShoppingProductId(
  productName: string,
  keyword: string,
  mallName?: string
): Promise<string | null> {
  try {
    logger.info('네이버 쇼핑 상품 ID 조회 시작', { productName, keyword });

    // 키워드로 검색
    const items = await shoppingSearchApi.searchTop40(keyword);

    if (items.length === 0) {
      logger.warn('검색 결과 없음', { keyword });
      return null;
    }

    // 1. 정확한 상품명 매칭 시도
    const exactMatch = items.find(
      (item) => normalizeTitle(item.title) === normalizeTitle(productName)
    );
    if (exactMatch) {
      logger.info('정확한 상품명 매칭 성공', {
        productId: exactMatch.productId,
        title: exactMatch.title,
      });
      return exactMatch.productId;
    }

    // 2. 스토어명 + 상품명 부분 매칭
    if (mallName) {
      const mallMatch = items.find(
        (item) =>
          item.mallName === mallName &&
          normalizeTitle(item.title).includes(normalizeTitle(productName).substring(0, 20))
      );
      if (mallMatch) {
        logger.info('스토어명 + 상품명 매칭 성공', {
          productId: mallMatch.productId,
          mallName: mallMatch.mallName,
        });
        return mallMatch.productId;
      }
    }

    // 3. 상품명 유사도 매칭 (70% 이상 일치)
    const similarMatch = items.find((item) => {
      const similarity = calculateSimilarity(
        normalizeTitle(item.title),
        normalizeTitle(productName)
      );
      return similarity >= 0.7;
    });
    if (similarMatch) {
      logger.info('유사도 매칭 성공', {
        productId: similarMatch.productId,
        title: similarMatch.title,
      });
      return similarMatch.productId;
    }

    logger.warn('매칭되는 상품 없음', { productName, keyword, itemCount: items.length });
    return null;
  } catch (error: any) {
    logger.error('네이버 쇼핑 상품 ID 조회 실패', { error: error.message });
    return null;
  }
}

/**
 * 상품 등록 (네이버 쇼핑 ID 자동 조회 포함)
 */
export async function registerProduct(input: ProductInput): Promise<ProductRegistrationResult> {
  try {
    logger.info('상품 등록 시작', { productName: input.productName });

    // 1. 네이버 쇼핑 상품 ID 자동 조회
    const naverShoppingProductId = await findNaverShoppingProductId(
      input.productName,
      input.representativeKeyword,
      input.mallName
    );

    // 2. DB에 상품 저장
    const result = await db.query(
      `INSERT INTO products (
        naver_product_id,
        product_name,
        naver_shopping_product_id,
        representative_keyword,
        category_id,
        excluded_from_test
      ) VALUES ($1, $2, $3, $4, $5, false)
      ON CONFLICT (naver_product_id) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        naver_shopping_product_id = COALESCE(EXCLUDED.naver_shopping_product_id, products.naver_shopping_product_id),
        representative_keyword = EXCLUDED.representative_keyword,
        category_id = EXCLUDED.category_id,
        updated_at = NOW()
      RETURNING id`,
      [
        input.naverProductId,
        input.productName,
        naverShoppingProductId,
        input.representativeKeyword,
        input.categoryId || null,
      ]
    );

    const productId = result.rows[0]?.id;

    logger.info('상품 등록 완료', {
      productId,
      naverShoppingProductId: naverShoppingProductId || '미발견',
    });

    return {
      success: true,
      productId,
      naverShoppingProductId: naverShoppingProductId || undefined,
    };
  } catch (error: any) {
    logger.error('상품 등록 실패', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 기존 상품의 네이버 쇼핑 ID 업데이트
 */
export async function updateProductShoppingId(productId: number): Promise<boolean> {
  try {
    // 상품 정보 조회
    const productResult = await db.query(
      `SELECT product_name, representative_keyword FROM products WHERE id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      logger.warn('상품을 찾을 수 없음', { productId });
      return false;
    }

    const product = productResult.rows[0];

    // 네이버 쇼핑 ID 조회
    const naverShoppingProductId = await findNaverShoppingProductId(
      product.product_name,
      product.representative_keyword
    );

    if (!naverShoppingProductId) {
      logger.warn('네이버 쇼핑 ID를 찾을 수 없음', { productId });
      return false;
    }

    // DB 업데이트
    await db.query(
      `UPDATE products SET naver_shopping_product_id = $1, updated_at = NOW() WHERE id = $2`,
      [naverShoppingProductId, productId]
    );

    logger.info('네이버 쇼핑 ID 업데이트 완료', { productId, naverShoppingProductId });
    return true;
  } catch (error: any) {
    logger.error('네이버 쇼핑 ID 업데이트 실패', { error: error.message });
    return false;
  }
}

/**
 * 모든 상품의 네이버 쇼핑 ID 일괄 업데이트
 */
export async function batchUpdateShoppingIds(): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  try {
    // naver_shopping_product_id가 없는 상품 조회
    const products = await db.query(
      `SELECT id FROM products
       WHERE naver_shopping_product_id IS NULL
         AND excluded_from_test = false
         AND representative_keyword IS NOT NULL`
    );

    logger.info('쇼핑 ID 미설정 상품 발견', { count: products.rows.length });

    for (const product of products.rows) {
      const success = await updateProductShoppingId(product.id);
      if (success) {
        updated++;
      } else {
        failed++;
      }
    }

    logger.info('일괄 업데이트 완료', { updated, failed });
  } catch (error: any) {
    logger.error('일괄 업데이트 실패', { error: error.message });
  }

  return { updated, failed };
}

/**
 * 상품명 정규화 (HTML 태그 제거, 공백 정리)
 */
function normalizeTitle(title: string): string {
  return title
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/\s+/g, ' ') // 연속 공백 → 단일 공백
    .trim()
    .toLowerCase();
}

/**
 * 두 문자열의 유사도 계산 (0~1)
 * 간단한 Jaccard similarity 사용
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
