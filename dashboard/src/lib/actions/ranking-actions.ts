/**
 * @file ranking-actions.ts
 * @description 순위 추적 서버 액션
 * @responsibilities
 * - 상품명에서 키워드 추출
 * - 각 키워드별 순위 조회 및 DB 저장
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/client';
import { getProductRank } from '@/lib/naver-api/shopping-search-api';

interface KeywordRankResult {
  keyword: string;
  rank: number | null;
}

interface TrackRankResult {
  success: boolean;
  results?: KeywordRankResult[];
  trackedCount?: number;
  error?: string;
}

/**
 * 상품명에서 단일 키워드 추출
 * - 괄호/특수문자 제거
 * - 공백 기준으로 분리, 2글자 이상만 유지
 * - 실제 사람들이 검색하는 단일 키워드 단위로 순위 추적
 */
function extractKeywordsFromName(productName: string): string[] {
  const cleaned = productName
    .replace(/[\[\(【\{][^\]\)】\}]*[\]\)】\}]/g, '')
    .replace(/[\/\-_|+·•※★☆♥♡~!@#$%^&*=,.<>?;:'"]/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
  return [...new Set(words)];
}

/**
 * 상품의 모든 키워드 순위 추적
 * - 상품명에서 키워드 추출 + 대표 키워드 + tracked 키워드
 */
export async function trackProductRank(productId: number): Promise<TrackRankResult> {
  try {
    const supabase = createServerSupabase();

    // 상품 정보 조회
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('product_name, naver_shopping_product_id, representative_keyword')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return { success: false, error: '상품 정보를 찾을 수 없습니다' };
    }

    if (!product.naver_shopping_product_id) {
      return { success: false, error: '쇼핑 ID가 없습니다' };
    }

    // 키워드 수집 (중복 제거)
    const keywordSet = new Set<string>();

    // 1) 대표 키워드
    if (product.representative_keyword) {
      keywordSet.add(product.representative_keyword);
    }

    // 2) 상품명에서 키워드 추출
    const nameKeywords = extractKeywordsFromName(product.product_name);
    for (const kw of nameKeywords) {
      keywordSet.add(kw);
    }

    // 3) tracked 키워드 (keyword_product_mapping)
    const { data: mappings } = await supabase
      .from('keyword_product_mapping')
      .select('keyword_id, keywords(keyword)')
      .eq('product_id', productId)
      .eq('is_tracked', true);

    if (mappings) {
      for (const m of mappings) {
        const raw = m as unknown as { keywords: { keyword: string } | null };
        if (raw.keywords?.keyword) keywordSet.add(raw.keywords.keyword);
      }
    }

    const keywords = Array.from(keywordSet);

    if (keywords.length === 0) {
      return { success: false, error: '추적할 키워드가 없습니다' };
    }

    // 각 키워드 순위 조회
    const results: KeywordRankResult[] = [];
    const now = new Date().toISOString();
    let repKeywordRank: number | null = null;

    for (const keyword of keywords) {
      const { rank, apiCalls } = await getProductRank(
        keyword,
        product.naver_shopping_product_id
      );

      results.push({ keyword, rank });

      if (keyword === product.representative_keyword) {
        repKeywordRank = rank;
      }

      // keyword_ranking_daily에 기록
      await supabase.from('keyword_ranking_daily').insert({
        product_id: product.naver_shopping_product_id,
        keyword,
        rank,
        rank_limit: 1000,
        checked_at: now,
        api_calls: apiCalls,
      });
    }

    // 대표 키워드 순위 업데이트
    if (product.representative_keyword) {
      await supabase
        .from('products')
        .update({ representative_keyword_rank: repKeywordRank })
        .eq('id', productId);
    }

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);

    return {
      success: true,
      results,
      trackedCount: results.length,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, error: errorMessage };
  }
}
