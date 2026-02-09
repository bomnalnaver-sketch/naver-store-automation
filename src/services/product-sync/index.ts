/**
 * @file index.ts
 * @description 네이버 커머스 API를 통한 상품 자동 동기화 서비스
 * @responsibilities
 * - 스마트스토어 상품 전체 조회
 * - DB와 동기화 (신규 추가, 기존 업데이트)
 * - 삭제/판매중지 상품 처리
 * - 네이버 쇼핑 상품 ID 자동 조회
 */

import { db } from '@/db/client';
import { commerceApi, CommerceProduct } from '@/services/naver-api/commerce-api';
import { findNaverShoppingProductId } from '@/services/product-manager';
import { logger } from '@/utils/logger';

/** 동기화 결과 */
export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  shoppingIdUpdated: number;
  errors: string[];
  syncedAt: string;
}

/** 상품 동기화 설정 */
interface SyncOptions {
  /** 삭제된 상품 DB에서 제거 (false면 excluded_from_test만 true로 설정) */
  hardDelete?: boolean;
  /** 네이버 쇼핑 ID 자동 조회 여부 */
  autoFindShoppingId?: boolean;
}

const DEFAULT_OPTIONS: SyncOptions = {
  hardDelete: false,
  autoFindShoppingId: true,
};

/**
 * 네이버 커머스 API에서 상품 전체 조회
 */
async function fetchAllCommerceProducts(): Promise<CommerceProduct[]> {
  const allProducts: CommerceProduct[] = [];
  let page = 1;
  const size = 100;

  while (true) {
    const products = await commerceApi.getProducts({ page, size });

    if (products.length === 0) break;

    allProducts.push(...products);

    // 마지막 페이지면 종료
    if (products.length < size) break;

    page++;
  }

  return allProducts;
}

/**
 * 상품 동기화 메인 함수
 * Commerce API에서 상품 목록을 가져와 DB와 동기화
 */
export async function syncProducts(options?: SyncOptions): Promise<SyncResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result: SyncResult = {
    success: false,
    added: 0,
    updated: 0,
    removed: 0,
    shoppingIdUpdated: 0,
    errors: [],
    syncedAt: new Date().toISOString(),
  };

  try {
    logger.info('상품 동기화 시작');

    // 1. Commerce API에서 상품 목록 조회
    const commerceProducts = await fetchAllCommerceProducts();
    logger.info(`Commerce API 상품 조회 완료: ${commerceProducts.length}개`);

    if (commerceProducts.length === 0) {
      logger.warn('Commerce API에서 조회된 상품이 없습니다');
      result.success = true;
      return result;
    }

    // 2. 현재 DB 상품 목록 조회
    const dbProducts = await db.query(
      `SELECT id, naver_product_id, product_name, naver_shopping_product_id
       FROM products`
    );
    const dbProductMap = new Map<string, any>();
    for (const row of dbProducts.rows) {
      dbProductMap.set(row.naver_product_id, row);
    }

    // 3. Commerce 상품 ID 세트 생성 (삭제 감지용)
    const commerceProductIds = new Set(commerceProducts.map((p) => p.originProductNo.toString()));

    // 4. 상품 동기화 (추가/업데이트)
    for (const product of commerceProducts) {
      const productId = product.originProductNo.toString();
      const channelProduct = product.channelProducts?.[0];
      const categoryId = channelProduct?.categoryId || product.categoryId;
      const categoryName = channelProduct?.wholeCategoryName || product.wholeCategoryName;
      const statusType = channelProduct?.statusType || product.statusType;

      try {
        const existing = dbProductMap.get(productId);

        // 대표 키워드 추출 (상품명에서 첫 단어 또는 카테고리명)
        const representativeKeyword = extractRepresentativeKeyword(
          product.name,
          categoryName
        );

        if (existing) {
          // 기존 상품 업데이트
          await db.query(
            `UPDATE products SET
              product_name = $1,
              category_id = $2,
              category_name = $3,
              representative_keyword = COALESCE(representative_keyword, $4),
              excluded_from_test = CASE WHEN $5 = 'SALE' THEN false ELSE true END,
              updated_at = NOW()
             WHERE naver_product_id = $6`,
            [
              product.name,
              categoryId || null,
              categoryName || null,
              representativeKeyword,
              statusType,
              productId,
            ]
          );
          result.updated++;

          // 네이버 쇼핑 ID가 없으면 조회 시도
          if (opts.autoFindShoppingId && !existing.naver_shopping_product_id) {
            const shoppingId = await findNaverShoppingProductId(
              product.name,
              existing.representative_keyword || representativeKeyword
            );
            if (shoppingId) {
              await db.query(
                `UPDATE products SET naver_shopping_product_id = $1 WHERE naver_product_id = $2`,
                [shoppingId, productId]
              );
              result.shoppingIdUpdated++;
            }
          }
        } else {
          // 신규 상품 추가
          let naverShoppingProductId: string | null = null;

          // 네이버 쇼핑 ID 자동 조회
          if (opts.autoFindShoppingId) {
            naverShoppingProductId = await findNaverShoppingProductId(
              product.name,
              representativeKeyword
            );
            if (naverShoppingProductId) {
              result.shoppingIdUpdated++;
            }
          }

          await db.query(
            `INSERT INTO products (
              naver_product_id,
              product_name,
              naver_shopping_product_id,
              category_id,
              category_name,
              representative_keyword,
              excluded_from_test
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              productId,
              product.name,
              naverShoppingProductId,
              categoryId || null,
              categoryName || null,
              representativeKeyword,
              statusType !== 'SALE',
            ]
          );
          result.added++;
        }
      } catch (error: any) {
        const errorMsg = `상품 ${productId} 동기화 실패: ${error.message}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    // 5. 삭제된 상품 처리 (Commerce API에 없는 상품)
    for (const [naverProductId, dbProduct] of dbProductMap) {
      if (!commerceProductIds.has(naverProductId)) {
        try {
          if (opts.hardDelete) {
            // 하드 삭제
            await db.query(`DELETE FROM products WHERE id = $1`, [dbProduct.id]);
          } else {
            // 소프트 삭제 (테스트 제외 처리)
            await db.query(
              `UPDATE products SET excluded_from_test = true, updated_at = NOW() WHERE id = $1`,
              [dbProduct.id]
            );
          }
          result.removed++;
          logger.info(`삭제된 상품 처리: ${naverProductId}`, {
            hardDelete: opts.hardDelete,
          });
        } catch (error: any) {
          const errorMsg = `상품 ${naverProductId} 삭제 처리 실패: ${error.message}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    }

    result.success = result.errors.length === 0;

    logger.info('상품 동기화 완료', {
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      shoppingIdUpdated: result.shoppingIdUpdated,
      errors: result.errors.length,
    });

    return result;
  } catch (error: any) {
    logger.error('상품 동기화 실패', { error: error.message });
    result.errors.push(error.message);
    return result;
  }
}

/**
 * 상품명에서 대표 키워드 추출
 * - 상품명의 주요 단어 추출
 * - 불필요한 수식어 제거
 */
function extractRepresentativeKeyword(
  productName: string,
  categoryName?: string
): string {
  // 불필요한 패턴 제거
  const cleaned = productName
    .replace(/\[[^\]]*\]/g, '') // [브랜드명] 등 제거
    .replace(/\([^)]*\)/g, '') // (설명) 등 제거
    .replace(/[0-9]+[개입세트팩]+/g, '') // 수량 표시 제거
    .replace(/무료배송|당일발송|특가|할인|이벤트/g, '') // 프로모션 문구 제거
    .trim();

  // 첫 번째 의미있는 단어들 추출 (2~4단어)
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);

  if (words.length >= 2) {
    // 핵심 키워드 2개 조합
    return words.slice(0, 2).join(' ');
  } else if (words.length === 1 && words[0]) {
    return words[0];
  }

  // fallback: 카테고리명 사용
  return categoryName || productName.substring(0, 20);
}

/**
 * 단일 상품 즉시 동기화
 */
export async function syncSingleProduct(
  naverProductId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const product = await commerceApi.getProduct(naverProductId);
    const channelProduct = product.channelProducts?.[0];
    const categoryId = channelProduct?.categoryId || product.categoryId;
    const categoryName = channelProduct?.wholeCategoryName || product.wholeCategoryName;
    const statusType = channelProduct?.statusType || product.statusType;

    const representativeKeyword = extractRepresentativeKeyword(
      product.name,
      categoryName
    );

    // 네이버 쇼핑 ID 조회
    const naverShoppingProductId = await findNaverShoppingProductId(
      product.name,
      representativeKeyword
    );

    await db.query(
      `INSERT INTO products (
        naver_product_id,
        product_name,
        naver_shopping_product_id,
        category_id,
        category_name,
        representative_keyword,
        excluded_from_test
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (naver_product_id) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        naver_shopping_product_id = COALESCE(EXCLUDED.naver_shopping_product_id, products.naver_shopping_product_id),
        category_id = EXCLUDED.category_id,
        category_name = EXCLUDED.category_name,
        representative_keyword = COALESCE(products.representative_keyword, EXCLUDED.representative_keyword),
        excluded_from_test = CASE WHEN $8 = 'SALE' THEN false ELSE true END,
        updated_at = NOW()`,
      [
        product.originProductNo.toString(),
        product.name,
        naverShoppingProductId,
        categoryId || null,
        categoryName || null,
        representativeKeyword,
        statusType !== 'SALE',
        statusType,
      ]
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
