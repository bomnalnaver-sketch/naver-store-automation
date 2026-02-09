/**
 * @file setup.ts
 * @description Jest 테스트 환경 설정
 */

// 환경 변수 설정
process.env.NODE_ENV = 'test';

// 타임아웃 설정
jest.setTimeout(30000);

// 모킹 초기화
beforeEach(() => {
  jest.clearAllMocks();
});
