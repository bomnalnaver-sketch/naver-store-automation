/**
 * @file product-actions.ts
 * @description 상품 관리 Server Actions
 */

'use server';

import { createServerSupabase } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';

/** 상품 등록 입력 */
interface RegisterProductInput {
  naverProductId: string;
  productName: string;
  representativeKeyword: string;
  categoryId?: string;
}

/** 상품 등록 결과 */
interface RegisterProductResult {
  success: boolean;
  productId?: number;
  error?: string;
}

/**
 * 상품 등록
 */
export async function registerProduct(input: RegisterProductInput): Promise<RegisterProductResult> {
  try {
    const supabase = createServerSupabase();

    // 상품 등록 (upsert)
    const { data, error } = await supabase
      .from('products')
      .upsert(
        {
          naver_product_id: input.naverProductId,
          product_name: input.productName,
          representative_keyword: input.representativeKeyword,
          category_id: input.categoryId || null,
          excluded_from_test: false,
        },
        { onConflict: 'naver_product_id' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('상품 등록 실패:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/products');

    return {
      success: true,
      productId: data?.id,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('상품 등록 오류:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * 상품 정보 갱신 (네이버 쇼핑 ID 업데이트)
 */
export async function refreshProductInfo(productId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabase();

    // 상품 정보 조회
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('product_name, representative_keyword')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return { success: false, error: '상품을 찾을 수 없습니다' };
    }

    // 네이버 쇼핑 검색 API 호출을 위한 외부 서비스 호출
    // 대시보드에서는 직접 API 호출이 어려우므로, 별도 API 엔드포인트를 사용하거나
    // 여기서는 단순히 updated_at만 갱신하고, 실제 쇼핑 ID 업데이트는 일일 자동화에서 처리
    const { error: updateError } = await supabase
      .from('products')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, error: errorMessage };
  }
}

/**
 * 상품 삭제 (테스트 제외 처리)
 */
export async function excludeProduct(productId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabase();

    const { error } = await supabase
      .from('products')
      .update({ excluded_from_test: true })
      .eq('id', productId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/products');

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, error: errorMessage };
  }
}

/**
 * 모든 상품의 쇼핑 ID 일괄 갱신 요청
 * 실제 갱신은 일일 자동화에서 처리됨
 */
export async function requestBatchRefresh(): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createServerSupabase();

    // 쇼핑 ID가 없는 상품들의 updated_at 갱신 (갱신 필요 표시)
    const { data, error } = await supabase
      .from('products')
      .update({ updated_at: new Date().toISOString() })
      .is('naver_shopping_product_id', null)
      .eq('excluded_from_test', false)
      .select('id');

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath('/products');

    return {
      success: true,
      message: `${data?.length || 0}개 상품이 다음 자동화에서 갱신됩니다`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, message: errorMessage };
  }
}
