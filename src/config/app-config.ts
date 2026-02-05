/**
 * @file app-config.ts
 * @description 애플리케이션 설정 상수
 * @responsibilities
 * - 광고 키워드 관련 설정
 * - 상품 A/B 테스트 관련 설정
 * - AI 분석 관련 설정
 */

/**
 * 광고 키워드 최적화 설정
 */
export const AD_KEYWORD_CONFIG = {
  /** 상품당 최대 키워드 개수 */
  MAX_KEYWORDS_PER_PRODUCT: 5,

  /** 신규 키워드 테스트 보호 기간 (일) */
  TEST_PROTECTION_DAYS: 14,

  /** ROAS 최소 기준 (%) - 이 수치 이하면 탈락 대상 */
  MIN_ROAS_THRESHOLD: 100,

  /** 키워드 평가 우선순위 가중치 */
  EVALUATION_WEIGHTS: {
    CONVERSION_RATE: 0.4, // 전환율 (최고 우선순위)
    CLICK_RATE: 0.3, // 클릭률 (CTR)
    IMPRESSIONS: 0.15, // 노출수
    AVG_CLICK_COST: 0.1, // 평균 클릭 비용 (낮을수록 좋음)
    BID_AMOUNT: 0.05, // 입찰가
  },

  /** 일일 최대 신규 키워드 테스트 수 */
  MAX_DAILY_NEW_KEYWORDS: 10,

  /** 연관 키워드 조회 시 최대 결과 수 */
  MAX_RELATED_KEYWORDS: 50,
} as const;

/**
 * 상품 최적화 설정
 */
export const PRODUCT_CONFIG = {
  /** A/B 테스트 기간 (일) */
  AB_TEST_DURATION_DAYS: 14,

  /** 일일 최대 신규 A/B 테스트 수 */
  MAX_DAILY_NEW_TESTS: 5,

  /** A/B 테스트 평가 우선순위 가중치 */
  EVALUATION_WEIGHTS: {
    CONVERSION_RATE: 0.7, // 전환율 (최고 우선순위)
    CLICK_RATE: 0.3, // 클릭률
  },

  /** 통계적 유의성 최소 샘플 수 */
  MIN_SAMPLE_SIZE: 100,

  /** 최소 개선율 (%) - 이 수치 이상 개선되어야 채택 */
  MIN_IMPROVEMENT_RATE: 5,
} as const;

/**
 * AI 분석 설정
 */
export const AI_CONFIG = {
  /** Claude API 모델 */
  MODEL: 'claude-3-5-sonnet-20241022',

  /** 최대 토큰 수 */
  MAX_TOKENS: 4000,

  /** Temperature (창의성) */
  TEMPERATURE: 0.7,

  /** 타임아웃 (ms) */
  TIMEOUT: 60000,
} as const;

/**
 * API 호출 설정
 */
export const API_CONFIG = {
  /** 최대 재시도 횟수 */
  MAX_RETRIES: 3,

  /** 타임아웃 (ms) */
  TIMEOUT: 30000,

  /** 재시도 지연 (ms) */
  RETRY_DELAY: 1000,

  /** 지수 백오프 여부 */
  EXPONENTIAL_BACKOFF: true,

  /** 네이버 커머스 API Rate Limit */
  NAVER_COMMERCE: {
    /** 초당 최대 요청 수 - 초과 시 일시적 중단됨 */
    MAX_REQUESTS_PER_SECOND: 2,
    /** Rate limit 버퍼 (안전 마진) */
    RATE_LIMIT_BUFFER: 0.9, // 실제로는 초당 1.8회로 제한
  },

  /** 네이버 검색광고 API Rate Limit */
  NAVER_SEARCH_AD: {
    /** 초당 최대 요청 수 */
    MAX_REQUESTS_PER_SECOND: 10,
    /** Rate limit 버퍼 (안전 마진) */
    RATE_LIMIT_BUFFER: 0.9,
  },
} as const;

/**
 * 데이터베이스 설정
 */
export const DB_CONFIG = {
  /** 연결 풀 최대 크기 */
  MAX_POOL_SIZE: 20,

  /** 연결 타임아웃 (ms) */
  CONNECTION_TIMEOUT: 10000,

  /** 쿼리 타임아웃 (ms) */
  QUERY_TIMEOUT: 30000,
} as const;

/**
 * 로깅 설정
 */
export const LOG_CONFIG = {
  /** 로그 레벨 */
  LEVEL: process.env.LOG_LEVEL || 'info',

  /** 파일 로깅 여부 */
  FILE_LOGGING: true,

  /** 로그 파일 경로 */
  FILE_PATH: './logs',

  /** 로그 파일 최대 크기 (bytes) */
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

  /** 로그 파일 최대 보관 개수 */
  MAX_FILES: 7,
} as const;

/**
 * Slack 알림 설정
 */
export const SLACK_CONFIG = {
  /** 일일 리포트 발송 시간 (24시간 형식) */
  DAILY_REPORT_TIME: '09:00',

  /** 에러 알림 임계값 */
  ERROR_THRESHOLD: 5,

  /** 크리티컬 에러 즉시 알림 여부 */
  CRITICAL_ERROR_IMMEDIATE_ALERT: true,
} as const;

/**
 * GitHub Actions 스케줄 설정
 */
export const SCHEDULE_CONFIG = {
  /** 일일 실행 시간 (KST 기준) */
  DAILY_RUN_TIME: '06:00',

  /** 타임존 */
  TIMEZONE: 'Asia/Seoul',
} as const;

/**
 * 환경 변수 검증
 */
export function validateEnv() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'NAVER_COMMERCE_CLIENT_ID',
    'NAVER_COMMERCE_CLIENT_SECRET',
    'NAVER_SEARCH_AD_API_KEY',
    'NAVER_SEARCH_AD_SECRET_KEY',
    'NAVER_SEARCH_AD_CUSTOMER_ID',
    'CLAUDE_API_KEY',
    // SLACK_WEBHOOK_URL은 선택사항
  ];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
        'Please check your .env file and ensure all required variables are set.'
    );
  }
}

/**
 * 전체 설정 객체
 */
export const APP_CONFIG = {
  AD_KEYWORD: AD_KEYWORD_CONFIG,
  PRODUCT: PRODUCT_CONFIG,
  AI: AI_CONFIG,
  API: API_CONFIG,
  DB: DB_CONFIG,
  LOG: LOG_CONFIG,
  SLACK: SLACK_CONFIG,
  SCHEDULE: SCHEDULE_CONFIG,
} as const;
