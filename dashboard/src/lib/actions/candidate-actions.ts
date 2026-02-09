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
