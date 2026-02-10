/**
 * @file candidate-actions.ts
 * @description 키워드 후보 승인/거부 Server Actions
 * @responsibilities
 * - 후보 승인 처리
 * - 후보 거부 처리
 * - 일괄 승인/거부 처리
 */

'use server';

import { createServerSupabase } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';
import type { ApprovalStatus } from '@/lib/supabase/types';

// ============================================
// 타입 정의
// ============================================

export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
}

// ============================================
// 단일 후보 승인/거부
// ============================================

/**
 * 키워드 후보 승인
 */
export async function approveCandidate(
  candidateId: number,
  reason?: string
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    // 후보 상태 업데이트
    const { error: updateError } = await supabase
      .from('keyword_candidates')
      .update({
        approval_status: 'approved' as ApprovalStatus,
        approval_reason: reason ?? '수동 승인',
        approval_at: new Date().toISOString(),
        status: 'candidate', // pending_approval → candidate
      })
      .eq('id', candidateId)
      .eq('approval_status', 'pending'); // pending 상태인 경우만

    if (updateError) {
      console.error('Failed to approve candidate:', updateError);
      return {
        success: false,
        message: '승인 처리 실패',
        error: updateError.message,
      };
    }

    // 라이프사이클 로그 기록
    await supabase
      .from('keyword_lifecycle_logs')
      .insert({
        candidate_id: candidateId,
        prev_status: 'pending_approval',
        new_status: 'candidate',
        reason: reason ?? '수동 승인',
      });

    revalidatePath('/candidates');
    revalidatePath('/');

    return {
      success: true,
      message: '키워드 후보가 승인되었습니다.',
    };
  } catch (error) {
    console.error('Error approving candidate:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 키워드 후보 거부
 */
export async function rejectCandidate(
  candidateId: number,
  reason: string
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    // 후보 상태 업데이트
    const { error: updateError } = await supabase
      .from('keyword_candidates')
      .update({
        approval_status: 'rejected' as ApprovalStatus,
        approval_reason: reason,
        approval_at: new Date().toISOString(),
        status: 'rejected',
      })
      .eq('id', candidateId)
      .eq('approval_status', 'pending');

    if (updateError) {
      console.error('Failed to reject candidate:', updateError);
      return {
        success: false,
        message: '거부 처리 실패',
        error: updateError.message,
      };
    }

    // 라이프사이클 로그 기록
    await supabase
      .from('keyword_lifecycle_logs')
      .insert({
        candidate_id: candidateId,
        prev_status: 'pending_approval',
        new_status: 'rejected',
        reason,
      });

    revalidatePath('/candidates');
    revalidatePath('/');

    return {
      success: true,
      message: '키워드 후보가 거부되었습니다.',
    };
  } catch (error) {
    console.error('Error rejecting candidate:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 일괄 처리
// ============================================

/**
 * 여러 후보 일괄 승인
 */
export async function approveCandidatesBulk(
  candidateIds: number[],
  reason?: string
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    // 일괄 업데이트
    const { error: updateError } = await supabase
      .from('keyword_candidates')
      .update({
        approval_status: 'approved' as ApprovalStatus,
        approval_reason: reason ?? '일괄 승인',
        approval_at: new Date().toISOString(),
        status: 'candidate',
      })
      .in('id', candidateIds)
      .eq('approval_status', 'pending');

    if (updateError) {
      console.error('Failed to bulk approve candidates:', updateError);
      return {
        success: false,
        message: '일괄 승인 처리 실패',
        error: updateError.message,
      };
    }

    // 라이프사이클 로그 기록
    const logs = candidateIds.map((candidateId) => ({
      candidate_id: candidateId,
      prev_status: 'pending_approval',
      new_status: 'candidate',
      reason: reason ?? '일괄 승인',
    }));

    await supabase.from('keyword_lifecycle_logs').insert(logs);

    revalidatePath('/candidates');
    revalidatePath('/');

    return {
      success: true,
      message: `${candidateIds.length}개 키워드 후보가 승인되었습니다.`,
    };
  } catch (error) {
    console.error('Error bulk approving candidates:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 키워드 후보 금지어 처리
 * - 후보 거부 + 불필요 키워드 사전(redundant_keywords_dict)에 등록
 */
export async function blacklistCandidate(
  candidateId: number
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    // 후보 정보 조회
    const { data: candidate, error: fetchError } = await supabase
      .from('keyword_candidates')
      .select('keyword')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      return {
        success: false,
        message: '후보 정보 조회 실패',
        error: fetchError?.message ?? 'Not found',
      };
    }

    // 후보 상태 업데이트 (거부)
    const { error: updateError } = await supabase
      .from('keyword_candidates')
      .update({
        approval_status: 'rejected' as ApprovalStatus,
        approval_reason: '금지어 등록',
        approval_at: new Date().toISOString(),
        status: 'rejected',
      })
      .eq('id', candidateId);

    if (updateError) {
      return {
        success: false,
        message: '금지어 처리 실패',
        error: updateError.message,
      };
    }

    // 불필요 키워드 사전에 등록 (중복 방지)
    const { data: existing } = await supabase
      .from('redundant_keywords_dict')
      .select('id')
      .eq('keyword', candidate.keyword)
      .maybeSingle();

    if (!existing) {
      await supabase.from('redundant_keywords_dict').insert({
        keyword: candidate.keyword,
        verified: true,
        note: '금지어 (후보관리에서 등록)',
      });
    }

    // 라이프사이클 로그 기록
    await supabase.from('keyword_lifecycle_logs').insert({
      candidate_id: candidateId,
      prev_status: 'pending_approval',
      new_status: 'rejected',
      reason: '금지어 등록',
    });

    revalidatePath('/candidates');
    revalidatePath('/settings');
    revalidatePath('/');

    return {
      success: true,
      message: `"${candidate.keyword}" 키워드가 금지어로 등록되었습니다.`,
    };
  } catch (error) {
    console.error('Error blacklisting candidate:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 여러 후보 일괄 금지어 처리
 * - 일괄 거부 + 불필요 키워드 사전 등록
 */
export async function blacklistCandidatesBulk(
  candidateIds: number[]
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    // 후보 키워드 목록 조회
    const { data: candidates, error: fetchError } = await supabase
      .from('keyword_candidates')
      .select('id, keyword')
      .in('id', candidateIds);

    if (fetchError || !candidates?.length) {
      return {
        success: false,
        message: '후보 정보 조회 실패',
        error: fetchError?.message ?? 'Not found',
      };
    }

    // 일괄 거부
    const { error: updateError } = await supabase
      .from('keyword_candidates')
      .update({
        approval_status: 'rejected' as ApprovalStatus,
        approval_reason: '금지어 등록',
        approval_at: new Date().toISOString(),
        status: 'rejected',
      })
      .in('id', candidateIds);

    if (updateError) {
      return {
        success: false,
        message: '일괄 금지어 처리 실패',
        error: updateError.message,
      };
    }

    // 기존 불필요 키워드 사전 조회 (중복 방지)
    const keywords = candidates.map((c) => c.keyword);
    const { data: existingDict } = await supabase
      .from('redundant_keywords_dict')
      .select('keyword')
      .in('keyword', keywords);

    const existingSet = new Set((existingDict ?? []).map((d) => d.keyword));
    const newKeywords = keywords.filter((k) => !existingSet.has(k));

    if (newKeywords.length > 0) {
      await supabase.from('redundant_keywords_dict').insert(
        newKeywords.map((keyword) => ({
          keyword,
          verified: true,
          note: '금지어 (후보관리에서 일괄 등록)',
        }))
      );
    }

    // 라이프사이클 로그
    const logs = candidateIds.map((candidateId) => ({
      candidate_id: candidateId,
      prev_status: 'pending_approval',
      new_status: 'rejected',
      reason: '금지어 등록',
    }));
    await supabase.from('keyword_lifecycle_logs').insert(logs);

    revalidatePath('/candidates');
    revalidatePath('/settings');
    revalidatePath('/');

    return {
      success: true,
      message: `${candidateIds.length}개 키워드가 금지어로 등록되었습니다.`,
    };
  } catch (error) {
    console.error('Error bulk blacklisting candidates:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 삭제 (목록에서만 제거, 다시 발굴 가능)
// ============================================

/**
 * 키워드 후보 삭제 (DB에서 row 삭제)
 * 거부와 달리, 삭제된 키워드는 다음 발굴 시 다시 등장할 수 있음
 */
export async function deleteCandidate(
  candidateId: number
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    const { error } = await supabase
      .from('keyword_candidates')
      .delete()
      .eq('id', candidateId);

    if (error) {
      return {
        success: false,
        message: '삭제 실패',
        error: error.message,
      };
    }

    revalidatePath('/candidates');
    revalidatePath('/');

    return {
      success: true,
      message: '키워드 후보가 삭제되었습니다.',
    };
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 여러 후보 일괄 삭제
 */
export async function deleteCandidatesBulk(
  candidateIds: number[]
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    const { error } = await supabase
      .from('keyword_candidates')
      .delete()
      .in('id', candidateIds);

    if (error) {
      return {
        success: false,
        message: '일괄 삭제 실패',
        error: error.message,
      };
    }

    revalidatePath('/candidates');
    revalidatePath('/');

    return {
      success: true,
      message: `${candidateIds.length}개 키워드 후보가 삭제되었습니다.`,
    };
  } catch (error) {
    console.error('Error bulk deleting candidates:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 여러 후보 일괄 거부
 */
export async function rejectCandidatesBulk(
  candidateIds: number[],
  reason: string
): Promise<ActionResult> {
  try {
    const supabase = createServerSupabase();

    // 일괄 업데이트
    const { error: updateError } = await supabase
      .from('keyword_candidates')
      .update({
        approval_status: 'rejected' as ApprovalStatus,
        approval_reason: reason,
        approval_at: new Date().toISOString(),
        status: 'rejected',
      })
      .in('id', candidateIds)
      .eq('approval_status', 'pending');

    if (updateError) {
      console.error('Failed to bulk reject candidates:', updateError);
      return {
        success: false,
        message: '일괄 거부 처리 실패',
        error: updateError.message,
      };
    }

    // 라이프사이클 로그 기록
    const logs = candidateIds.map((candidateId) => ({
      candidate_id: candidateId,
      prev_status: 'pending_approval',
      new_status: 'rejected',
      reason,
    }));

    await supabase.from('keyword_lifecycle_logs').insert(logs);

    revalidatePath('/candidates');
    revalidatePath('/');

    return {
      success: true,
      message: `${candidateIds.length}개 키워드 후보가 거부되었습니다.`,
    };
  } catch (error) {
    console.error('Error bulk rejecting candidates:', error);
    return {
      success: false,
      message: '오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
