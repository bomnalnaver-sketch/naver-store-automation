/**
 * @file discovery-actions.ts
 * @description 키워드 발굴 수동 트리거 Server Actions
 * @responsibilities
 * - npm run discover-keywords 스크립트 실행
 * - 발굴 결과 반환
 */

'use server';

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { revalidatePath } from 'next/cache';

const execAsync = promisify(exec);

export interface DiscoveryResult {
  success: boolean;
  totalDiscovered: number;
  totalSelected: number;
  pendingApproval: number;
  productsProcessed: number;
  duration: number;
  errors: string[];
  message: string;
}

/**
 * 키워드 발굴 + 선정 수동 실행
 * 백엔드의 discover-keywords 스크립트를 트리거
 */
export async function triggerKeywordDiscovery(): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    success: false,
    totalDiscovered: 0,
    totalSelected: 0,
    pendingApproval: 0,
    productsProcessed: 0,
    duration: 0,
    errors: [],
    message: '',
  };

  try {
    const rootDir = path.resolve(process.cwd(), '..');

    console.log('키워드 발굴 스크립트 실행 중...');
    console.log('실행 경로:', rootDir);

    const { stdout, stderr } = await execAsync('npm run discover-keywords', {
      cwd: rootDir,
      timeout: 300000, // 5분 타임아웃
    });

    if (stderr) {
      console.log('스크립트 stderr:', stderr);
    }

    // JSON 결과 파싱 시도
    try {
      const lines = stdout.trim().split('\n');
      // 마지막 JSON 블록 찾기
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
        result.success = parsed.success ?? true;
        result.totalDiscovered = parsed.totalDiscovered ?? 0;
        result.totalSelected = parsed.totalSelected ?? 0;
        result.pendingApproval = parsed.pendingApproval ?? 0;
        result.productsProcessed = parsed.productsProcessed ?? 0;
        result.duration = parsed.duration ?? 0;
        result.errors = parsed.errors ?? [];
      } else {
        result.success = true;
      }
    } catch {
      // JSON 파싱 실패해도 스크립트는 성공
      result.success = true;
    }

    result.message = `키워드 발굴 완료: ${result.totalDiscovered}개 발굴, ${result.totalSelected}개 선정`;

    revalidatePath('/candidates');
    revalidatePath('/');

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('키워드 발굴 스크립트 실패:', errorMessage);
    result.errors.push(errorMessage);
    result.message = `키워드 발굴 실패: ${errorMessage}`;
    return result;
  }
}
