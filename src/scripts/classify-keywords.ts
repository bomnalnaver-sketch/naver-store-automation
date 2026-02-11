/**
 * @file classify-keywords.ts
 * @description 키워드 매핑 생성 + 분류 실행 스크립트
 * @responsibilities
 * - 상품명 토큰화 → keywords 마스터 테이블 INSERT
 * - keyword_product_mapping 생성
 * - 승인된 후보(keyword_candidates)도 매핑에 반영
 * - 키워드 유형/색깔 분류 실행
 */

import 'dotenv/config';
import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { tokenize } from '@/services/keyword-classification';
import { runFullClassificationForProduct } from '@/services/keyword-classification';

// ============================================
// 타입
// ============================================

interface Product {
  id: number;
  product_name: string;
  representative_keyword: string | null;
}

interface ClassifyResult {
  success: boolean;
  productsProcessed: number;
  keywordsMapped: number;
  keywordsClassified: number;
  errors: number;
}

// ============================================
// 메인 로직
// ============================================

/**
 * 상품명에서 키워드를 추출하고 매핑 생성
 * 1. 상품명 개별 토큰 추출 (N-gram 합성 없음)
 * 2. keyword_candidates에서 승인된 키워드 가져오기
 * 3. keywords 마스터에 UPSERT
 * 4. keyword_product_mapping에 UPSERT
 * 5. 기존 합성 키워드 매핑 및 고아 키워드 삭제
 */
async function buildKeywordMappings(product: Product): Promise<number> {
  const productName = product.product_name;
  const tokens = tokenize(productName);
  let mapped = 0;

  // 1. 상품명 토큰에서 키워드 후보 생성
  const keywordSet = new Set<string>();

  // 개별 토큰 (2글자 이상)
  for (const token of tokens) {
    if (token.length >= 2 && !/^\d+$/.test(token)) {
      keywordSet.add(token);
    }
  }

  // 대표 키워드 추가
  if (product.representative_keyword) {
    keywordSet.add(product.representative_keyword);
  }

  // 2. 승인된 후보 키워드 추가
  const candidatesResult = await db.query(
    `SELECT keyword FROM keyword_candidates
     WHERE product_id = $1 AND approval_status = 'approved'`,
    [product.id]
  );
  for (const row of candidatesResult.rows) {
    keywordSet.add(row.keyword);
  }

  // 3. 기존 매핑 중 현재 keywordSet에 없는 것은 삭제
  // (이전에 N-gram 합성으로 생성된 불필요 키워드 정리)
  const existingMappings = await db.query(
    `SELECT kpm.keyword_id, k.keyword
     FROM keyword_product_mapping kpm
     JOIN keywords k ON k.id = kpm.keyword_id
     WHERE kpm.product_id = $1`,
    [product.id]
  );

  const keywordSetLower = new Set(
    Array.from(keywordSet).map((k) => k.toLowerCase())
  );

  for (const row of existingMappings.rows) {
    if (!keywordSetLower.has(row.keyword.toLowerCase())) {
      // 매핑 삭제
      await db.query(
        `DELETE FROM keyword_product_mapping
         WHERE keyword_id = $1 AND product_id = $2`,
        [row.keyword_id, product.id]
      );

      // 해당 키워드가 다른 상품에도 매핑되어 있지 않으면 keywords 테이블에서도 삭제
      const otherMappings = await db.query(
        `SELECT 1 FROM keyword_product_mapping WHERE keyword_id = $1 LIMIT 1`,
        [row.keyword_id]
      );
      if (otherMappings.rows.length === 0) {
        await db.query(`DELETE FROM keywords WHERE id = $1`, [row.keyword_id]);
      }

      logger.info(`합성 키워드 삭제: "${row.keyword}" (상품 ${product.id})`);
    }
  }

  // 4. keywords 마스터 UPSERT + mapping 생성
  for (const keyword of keywordSet) {
    try {
      // keywords 마스터 UPSERT
      const keywordResult = await db.query(
        `INSERT INTO keywords (keyword)
         VALUES ($1)
         ON CONFLICT (keyword) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [keyword]
      );

      const keywordId = keywordResult.rows[0].id;

      // placement 결정: 상품명에 포함되어 있는지 확인
      const nameNoSpace = productName.replace(/\s+/g, '').toLowerCase();
      const kwNoSpace = keyword.replace(/\s+/g, '').toLowerCase();
      const isInName = nameNoSpace.includes(kwNoSpace);
      const placement = isInName ? 'in_name' : 'candidate';

      // keyword_product_mapping UPSERT
      await db.query(
        `INSERT INTO keyword_product_mapping (keyword_id, product_id, placement, is_tracked, priority)
         VALUES ($1, $2, $3, true, $4)
         ON CONFLICT (keyword_id, product_id) DO UPDATE SET
           placement = EXCLUDED.placement,
           is_tracked = true,
           updated_at = NOW()`,
        [keywordId, product.id, placement, isInName ? 1 : 2]
      );

      mapped++;
    } catch (error: any) {
      logger.warn(`키워드 매핑 실패: ${keyword}`, { error: error.message });
    }
  }

  return mapped;
}

/**
 * 전체 상품에 대해 키워드 매핑 생성 + 분류 실행
 */
async function classifyAllProducts(): Promise<ClassifyResult> {
  const result: ClassifyResult = {
    success: true,
    productsProcessed: 0,
    keywordsMapped: 0,
    keywordsClassified: 0,
    errors: 0,
  };

  try {
    // 활성 상품 조회
    const productsResult = await db.query(
      `SELECT id, product_name, representative_keyword
       FROM products
       WHERE COALESCE(excluded_from_test, false) = false
       ORDER BY id`
    );
    const products: Product[] = productsResult.rows;

    logger.info(`키워드 분류 대상 상품: ${products.length}개`);

    for (const product of products) {
      try {
        // Step 1: 키워드 매핑 생성
        const mapped = await buildKeywordMappings(product);
        result.keywordsMapped += mapped;

        logger.info(`[상품 ${product.id}] 키워드 매핑 생성 완료: ${mapped}개`);

        // Step 2: 유형/색깔 분류 실행
        await runFullClassificationForProduct(product.id);
        result.keywordsClassified++;

        logger.info(`[상품 ${product.id}] 키워드 분류 완료`);

        result.productsProcessed++;
      } catch (error: any) {
        result.errors++;
        logger.error(`[상품 ${product.id}] 처리 실패`, { error: error.message });
      }
    }
  } catch (error: any) {
    result.success = false;
    logger.error('키워드 분류 전체 실패', { error: error.message });
  }

  return result;
}

// ============================================
// 실행
// ============================================

async function main() {
  logger.info('=== 키워드 매핑 생성 + 분류 스크립트 시작 ===');

  const startTime = Date.now();
  const result = await classifyAllProducts();
  const duration = Date.now() - startTime;

  logger.info('=== 키워드 매핑 생성 + 분류 스크립트 완료 ===', {
    ...result,
    durationMs: duration,
  });

  // JSON 결과 출력 (대시보드 파싱용)
  console.log(JSON.stringify({
    success: result.success,
    productsProcessed: result.productsProcessed,
    keywordsMapped: result.keywordsMapped,
    keywordsClassified: result.keywordsClassified,
    errors: result.errors,
    duration,
  }));

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('스크립트 실패:', error);
  process.exit(1);
});
