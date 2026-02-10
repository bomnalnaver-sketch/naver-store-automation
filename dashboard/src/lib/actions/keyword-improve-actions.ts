/**
 * @file keyword-improve-actions.ts
 * @description 키워드 개선 페이지 Server Actions
 * @responsibilities
 * - 상품명 업데이트 (로컬 DB + 네이버 스토어 적용)
 * - 키워드 순서 재배치 미리보기
 * - 키워드 추가/제거 추천 반영
 */

'use server';

import { createServerSupabase } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// ============================================
// 타입 정의
// ============================================

export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
}

// ============================================
// 상품명 변경 (DB만 - 미리보기/저장)
// ============================================

/**
 * 상품명을 DB에만 저장 (스토어 미적용)
 */
export async function saveProductName(
  productId: number,
  newName: string
): Promise<ActionResult> {
  try {
    if (!newName.trim()) {
      return { success: false, message: '상품명을 입력해주세요.' };
    }
    if (newName.length > 100) {
      return { success: false, message: '상품명은 100자를 초과할 수 없습니다.' };
    }

    const supabase = createServerSupabase();

    const { error } = await supabase
      .from('products')
      .update({
        product_name: newName.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (error) {
      return { success: false, message: '저장 실패', error: error.message };
    }

    revalidatePath('/keyword-improve');
    revalidatePath(`/keyword-improve/${productId}`);
    revalidatePath('/products');

    return { success: true, message: '상품명이 저장되었습니다.' };
  } catch (error) {
    console.error('Error saving product name:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 상품명 스토어 적용
// ============================================

/**
 * 상품명을 네이버 스토어에 적용
 * DB 저장 + 네이버 커머스 API 호출 (API route 경유)
 */
export async function applyProductNameToStore(
  productId: number,
  newName: string
): Promise<ActionResult> {
  try {
    if (!newName.trim()) {
      return { success: false, message: '상품명을 입력해주세요.' };
    }
    if (newName.length > 100) {
      return { success: false, message: '상품명은 100자를 초과할 수 없습니다.' };
    }

    const supabase = createServerSupabase();

    // 상품 정보 조회
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('naver_product_id, product_name')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return { success: false, message: '상품을 찾을 수 없습니다.' };
    }

    const previousName = product.product_name;

    // DB 업데이트
    const { error: updateError } = await supabase
      .from('products')
      .update({
        product_name: newName.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (updateError) {
      return { success: false, message: 'DB 저장 실패', error: updateError.message };
    }

    // 변경 이력 로그
    await supabase.from('keyword_lifecycle_logs').insert({
      candidate_id: null,
      prev_status: 'product_name_change',
      new_status: 'applied',
      reason: `상품명 변경: "${previousName}" → "${newName.trim()}"`,
    });

    revalidatePath('/keyword-improve');
    revalidatePath(`/keyword-improve/${productId}`);
    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);

    return {
      success: true,
      message: `상품명이 저장되었습니다. 네이버 스토어 반영은 다음 자동화에서 처리됩니다.`,
    };
  } catch (error) {
    console.error('Error applying product name:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 키워드 순서 재배치
// ============================================

/**
 * 키워드 순서 재배치 결과를 기반으로 상품명 업데이트
 */
export async function applyReorderedName(
  productId: number,
  reorderedName: string
): Promise<ActionResult> {
  return saveProductName(productId, reorderedName);
}

// ============================================
// 키워드 추가/제거
// ============================================

/**
 * 상품명에 키워드 추가 (토큰 append)
 */
export async function addKeywordToProductName(
  productId: number,
  keyword: string
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    const { data: product } = await supabase
      .from('products')
      .select('product_name')
      .eq('id', productId)
      .single();

    if (!product) {
      return { success: false, message: '상품을 찾을 수 없습니다.' };
    }

    const currentName = product.product_name as string;
    const newName = `${currentName} ${keyword.trim()}`;

    if (newName.length > 100) {
      return { success: false, message: '상품명이 100자를 초과합니다.' };
    }

    return saveProductName(productId, newName);
  } catch (error) {
    console.error('Error adding keyword:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 상품명에서 키워드 제거 (토큰 제거)
 */
export async function removeKeywordFromProductName(
  productId: number,
  keyword: string
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    const { data: product } = await supabase
      .from('products')
      .select('product_name')
      .eq('id', productId)
      .single();

    if (!product) {
      return { success: false, message: '상품을 찾을 수 없습니다.' };
    }

    const currentName = product.product_name as string;
    const tokens = currentName.split(/\s+/);
    const targetLower = keyword.trim().toLowerCase();
    const filtered = tokens.filter((t) => t.toLowerCase() !== targetLower);

    if (filtered.length === tokens.length) {
      return { success: false, message: '해당 키워드를 찾을 수 없습니다.' };
    }

    const newName = filtered.join(' ');
    return saveProductName(productId, newName);
  } catch (error) {
    console.error('Error removing keyword:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 검색량/경쟁강도 보강
// ============================================

export interface MetricsEnrichResult {
  success: boolean;
  message: string;
  productsProcessed?: number;
  totalEnriched?: number;
  totalFailed?: number;
  error?: string;
}

/**
 * 키워드 검색량/경쟁강도 보강 (전체 상품)
 * 백엔드의 enrich-metrics 스크립트를 트리거
 */
export async function triggerMetricsEnrichment(): Promise<MetricsEnrichResult> {
  try {
    const rootDir = path.resolve(process.cwd(), '..');

    console.log('검색량 보강 스크립트 실행 중...');

    const { stdout, stderr } = await execAsync('npm run enrich-metrics', {
      cwd: rootDir,
      timeout: 300000, // 5분 타임아웃
    });

    if (stderr) {
      console.log('스크립트 stderr:', stderr);
    }

    // JSON 결과 파싱
    try {
      const lines = stdout.trim().split('\n');
      let jsonStr = '';
      let braceCount = 0;
      let inJson = false;

      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          inJson = true;
          jsonStr = '';
        }
        if (inJson) {
          jsonStr += line + '\n';
          braceCount += (line.match(/{/g) || []).length;
          braceCount -= (line.match(/}/g) || []).length;
          if (braceCount === 0 && jsonStr.trim()) {
            break;
          }
        }
      }

      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        revalidatePath('/keyword-improve');
        revalidatePath('/candidates');

        return {
          success: parsed.success ?? true,
          productsProcessed: parsed.productsProcessed ?? 0,
          totalEnriched: parsed.totalEnriched ?? 0,
          totalFailed: parsed.totalFailed ?? 0,
          message: `검색량 보강 완료: ${parsed.totalEnriched ?? 0}개 업데이트`,
        };
      }
    } catch {
      // JSON 파싱 실패해도 스크립트 성공
    }

    revalidatePath('/keyword-improve');
    revalidatePath('/candidates');

    return {
      success: true,
      message: '검색량 보강이 완료되었습니다.',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('검색량 보강 스크립트 실패:', errorMessage);
    return {
      success: false,
      message: `검색량 보강 실패: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

// ============================================
// 키워드 매핑 생성 + 분류
// ============================================

export interface ClassifyResult {
  success: boolean;
  message: string;
  productsProcessed?: number;
  keywordsMapped?: number;
  keywordsClassified?: number;
  errors?: number;
  error?: string;
}

/**
 * 키워드 매핑 생성 + 유형/색깔 분류 실행
 * 백엔드의 classify-keywords 스크립트를 트리거
 */
export async function triggerKeywordClassification(): Promise<ClassifyResult> {
  try {
    const rootDir = path.resolve(process.cwd(), '..');

    console.log('키워드 분류 스크립트 실행 중...');

    const { stdout, stderr } = await execAsync('npm run classify-keywords', {
      cwd: rootDir,
      timeout: 600000, // 10분 타임아웃 (분류는 API 호출이 많음)
    });

    if (stderr) {
      console.log('스크립트 stderr:', stderr);
    }

    // JSON 결과 파싱
    try {
      const lines = stdout.trim().split('\n');
      let jsonStr = '';
      let braceCount = 0;
      let inJson = false;

      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          inJson = true;
          jsonStr = '';
        }
        if (inJson) {
          jsonStr += line + '\n';
          braceCount += (line.match(/{/g) || []).length;
          braceCount -= (line.match(/}/g) || []).length;
          if (braceCount === 0 && jsonStr.trim()) {
            break;
          }
        }
      }

      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        revalidatePath('/keyword-improve');

        return {
          success: parsed.success ?? true,
          productsProcessed: parsed.productsProcessed ?? 0,
          keywordsMapped: parsed.keywordsMapped ?? 0,
          keywordsClassified: parsed.keywordsClassified ?? 0,
          errors: parsed.errors ?? 0,
          message: `키워드 분류 완료: ${parsed.keywordsMapped ?? 0}개 매핑, ${parsed.keywordsClassified ?? 0}개 분류`,
        };
      }
    } catch {
      // JSON 파싱 실패해도 스크립트 성공
    }

    revalidatePath('/keyword-improve');

    return {
      success: true,
      message: '키워드 분류가 완료되었습니다.',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('키워드 분류 스크립트 실패:', errorMessage);
    return {
      success: false,
      message: `키워드 분류 실패: ${errorMessage}`,
      error: errorMessage,
    };
  }
}
