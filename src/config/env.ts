/**
 * @file env.ts
 * @description 환경 변수 타입 정의 및 로드
 * @responsibilities
 * - 환경 변수 로드 (dotenv)
 * - 타입 안전한 환경 변수 접근
 * - 환경 변수 검증
 */

import dotenv from 'dotenv';
import { validateEnv } from './app-config';

// .env 파일 로드
dotenv.config();

/**
 * 환경 변수 타입 정의
 */
export interface EnvConfig {
  // 데이터베이스
  DATABASE_URL: string;

  // 네이버 커머스 API
  NAVER_COMMERCE_CLIENT_ID: string;
  NAVER_COMMERCE_CLIENT_SECRET: string;

  // 네이버 쇼핑 검색 API
  NAVER_SHOPPING_CLIENT_ID: string;
  NAVER_SHOPPING_CLIENT_SECRET: string;

  // 네이버 검색광고 API
  NAVER_SEARCH_AD_API_KEY: string;
  NAVER_SEARCH_AD_SECRET_KEY: string;
  NAVER_SEARCH_AD_CUSTOMER_ID: string;

  // Claude API
  CLAUDE_API_KEY: string;

  // Slack
  SLACK_WEBHOOK_URL: string;

  // 환경 설정
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;

  // 로깅
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

  // GitHub Actions (옵션)
  GITHUB_TOKEN?: string;
}

/**
 * 타입 안전한 환경 변수 가져오기
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

/**
 * 환경 변수 객체 생성
 */
export const env: EnvConfig = {
  // 데이터베이스
  DATABASE_URL: getEnvVar('DATABASE_URL'),

  // 네이버 커머스 API
  NAVER_COMMERCE_CLIENT_ID: getEnvVar('NAVER_COMMERCE_CLIENT_ID'),
  NAVER_COMMERCE_CLIENT_SECRET: getEnvVar('NAVER_COMMERCE_CLIENT_SECRET'),

  // 네이버 쇼핑 검색 API
  NAVER_SHOPPING_CLIENT_ID: getEnvVar('NAVER_SHOPPING_CLIENT_ID'),
  NAVER_SHOPPING_CLIENT_SECRET: getEnvVar('NAVER_SHOPPING_CLIENT_SECRET'),

  // 네이버 검색광고 API
  NAVER_SEARCH_AD_API_KEY: getEnvVar('NAVER_SEARCH_AD_API_KEY'),
  NAVER_SEARCH_AD_SECRET_KEY: getEnvVar('NAVER_SEARCH_AD_SECRET_KEY'),
  NAVER_SEARCH_AD_CUSTOMER_ID: getEnvVar('NAVER_SEARCH_AD_CUSTOMER_ID'),

  // Claude API
  CLAUDE_API_KEY: getEnvVar('CLAUDE_API_KEY'),

  // Slack (선택사항)
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',

  // 환경 설정
  NODE_ENV: (getEnvVar('NODE_ENV', 'development') as EnvConfig['NODE_ENV']),
  PORT: parseInt(getEnvVar('PORT', '3000'), 10),

  // 로깅
  LOG_LEVEL: (getEnvVar('LOG_LEVEL', 'info') as EnvConfig['LOG_LEVEL']),

  // GitHub Actions (옵션)
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};

/**
 * 환경 변수 검증 실행
 */
try {
  validateEnv();
  console.log('✓ Environment variables validated successfully');
} catch (error) {
  console.error('✗ Environment validation failed:', error);
  process.exit(1);
}

/**
 * 개발 환경 여부
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * 프로덕션 환경 여부
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * 테스트 환경 여부
 */
export const isTest = env.NODE_ENV === 'test';
