/**
 * @file index.ts
 * @description 애플리케이션 엔트리 포인트
 * @responsibilities
 * - 환경 변수 로드 및 검증
 * - 애플리케이션 초기화
 */

import { env } from './config/env';
import { APP_CONFIG } from './config/app-config';

console.log('🚀 네이버 스마트스토어 AI 자동화 시스템');
console.log('환경:', env.NODE_ENV);
console.log('포트:', env.PORT);
console.log('');

async function main() {
  try {
    console.log('✓ 환경 변수 로드 완료');
    console.log('✓ 설정 로드 완료');
    console.log('');
    console.log('시스템이 준비되었습니다.');
  } catch (error) {
    console.error('✗ 초기화 실패:', error);
    process.exit(1);
  }
}

main();
