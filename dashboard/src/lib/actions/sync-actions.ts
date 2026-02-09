/**
 * @file sync-actions.ts
 * @description 상품 동기화 Server Actions
 * @responsibilities
 * - npm run sync-products 스크립트 실행
 * - 상품 + 쇼핑 ID + 주간 판매량 동기화
 */

'use server';

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { revalidatePath } from 'next/cache';

const execAsync = promisify(exec);

/** 동기화 결과 */
export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  errors: string[];
  message: string;
}

/**
 * 전체 상품 동기화
 * npm run sync-products 스크립트 실행
 */
export async function syncAllProducts(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    added: 0,
    updated: 0,
    removed: 0,
    errors: [],
    message: '',
  };

  try {
    // 루트 프로젝트 경로 (dashboard의 상위 폴더)
    const rootDir = path.resolve(process.cwd(), '..');

    console.log('상품 동기화 스크립트 실행 중...');
    console.log('실행 경로:', rootDir);

    // npm run sync-products 실행
    const { stdout, stderr } = await execAsync('npm run sync-products', {
      cwd: rootDir,
      timeout: 120000, // 2분 타임아웃
    });

    console.log('스크립트 출력:', stdout);
    if (stderr) {
      console.log('스크립트 stderr:', stderr);
    }

    revalidatePath('/products');

    result.success = true;
    result.message = '동기화 완료 (상품 + 쇼핑 ID + 주간 판매량)';

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('동기화 스크립트 실패:', errorMessage);
    result.errors.push(errorMessage);
    result.message = `동기화 실패: ${errorMessage}`;
    return result;
  }
}
