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

  /** 네이버 쇼핑 검색 API Rate Limit */
  NAVER_SHOPPING: {
    /** 초당 최대 요청 수 (일일 25,000회 한도 별도 관리) */
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
    'NAVER_SHOPPING_CLIENT_ID',
    'NAVER_SHOPPING_CLIENT_SECRET',
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
 * 쇼핑 검색 API 설정
 */
export const SHOPPING_API_CONFIG = {
  /** 일일 API 호출 한도 */
  DAILY_CALL_LIMIT: 25000,
  /** 색깔 분류 분석 시 조회할 상품 수 */
  COLOR_ANALYSIS_DISPLAY: 40,
  /** 순위 추적 시 페이지당 조회 수 (API 최대값) */
  RANK_CHECK_DISPLAY: 100,
  /** API 호출 예산 분배 */
  API_BUDGET: {
    RANKING: 15000,
    COLOR_ANALYSIS: 5000,
    RESERVE: 5000,
  },
} as const;

/**
 * 키워드 분류 설정
 */
export const KEYWORD_CLASSIFICATION_CONFIG = {
  /** 색깔 분류 임계값 (%) */
  COLOR_THRESHOLDS: {
    /** 🟡 상품명전용: title 포함율 >= 95% */
    YELLOW_TITLE_RATIO: 95,
    /** 🟢 속성: title 포함율 >= 50% */
    GREEN_TITLE_RATIO: 50,
    /** ⚪ 카테고리: category 포함율 >= 80% */
    GRAY_CATEGORY_RATIO: 80,
    /** 🔵 태그: title 포함율 상한 */
    BLUE_TITLE_MAX: 50,
    /** 🔵 태그: category 포함율 상한 */
    BLUE_CATEGORY_MAX: 30,
  },
  /** 동의어 판별 허용 오차 (등록상품수 차이) */
  SYNONYM_TOLERANCE: 0,
  /** 등록상품수 비교 시 동일 판정 허용 비율 (5% 이내면 동일) */
  REGISTERED_COUNT_TOLERANCE_RATIO: 0.05,
} as const;

/**
 * 상품명 최적화 점수 설정
 */
export const SCORING_CONFIG = {
  /** 기본 점수 */
  BASE_SCORE: 100,
  /** 등급 임계값 */
  GRADE_THRESHOLDS: {
    S: 95,
    A: 85,
    B: 70,
    C: 60,
  },
  /** 감점 배점 */
  PENALTIES: {
    REDUNDANT_KEYWORD: -5,
    SYNONYM_DUPLICATE: -3,
    INTEGRAL_SPLIT: -10,
    ORDER_FIXED_WRONG: -10,
    ORDER_FIXED_INSERT: -10,
    COMPOSITE_REPEAT: -3,
  },
  /** 가점 배점 */
  BONUSES: {
    COMPOSITE_SPACE_SAVING_PER_EXTRA: 3,
    HIGH_KEYWORD_DENSITY: 10,
    INTEGRAL_CORRECT_PER: 2,
    KEYWORD_DENSITY_THRESHOLD: 0.9,
  },
} as const;

/**
 * 순위 추적 설정
 */
export const RANKING_CONFIG = {
  /** 순위 추적 최대 범위 */
  RANK_CHECK_LIMIT: 1000,
  /** 페이지당 표시 수 (API 고정값) */
  DISPLAY_PER_REQUEST: 100,
  /** API 호출 간 딜레이 (ms) */
  RATE_LIMIT_DELAY: 100,
  /** 순위 변동 알림 기준 */
  RANK_CHANGE_ALERT_THRESHOLD: 50,
} as const;

/**
 * 인기도 단계별 전략 설정
 */
export const POPULARITY_STAGE_CONFIG = {
  STAGES: {
    /** 극초반: 대표키워드 순위 500위+ */
    EXTREME_EARLY: {
      MIN_RANK: 500,
      MAX_SEARCH_VOLUME_FOR_YELLOW: 1000,
      ALLOW_GREEN: false,
      ALLOW_GRAY: false,
    },
    /** 성장기: 대표키워드 순위 100~500위 */
    GROWTH: {
      MIN_RANK: 100,
      MAX_RANK: 500,
      MAX_SEARCH_VOLUME_FOR_YELLOW: 5000,
      ALLOW_GREEN: true,
      ALLOW_GRAY: false,
    },
    /** 안정기: 대표키워드 순위 100위 이내 */
    STABLE: {
      MAX_RANK: 100,
      ALLOW_GREEN: true,
      ALLOW_GRAY: true,
    },
  },
  /** 인기도 급변 감지 임계값 (순위 변동) */
  SURGE_DETECTION_THRESHOLD: 50,
} as const;

/**
 * 키워드 후보 시스템 설정
 */
export const KEYWORD_CANDIDATE_CONFIG = {
  /** 테스트 관련 */
  TEST: {
    /** 테스트 기간 (일) */
    DURATION_DAYS: 14,
    /** 테스트 성공 기준: 연속 1페이지 진입 일수 */
    SUCCESS_CONSECUTIVE_DAYS: 3,
    /** 동시 테스트 가능 키워드 수 */
    MAX_CONCURRENT: 3,
    /** 타임아웃 (테스트 기간 초과 시) */
    TIMEOUT_DAYS: 14,
  },

  /** 1페이지 기준 */
  TOP_PAGE: {
    /** 1페이지 = 상위 40위 (광고 제외) */
    RANK_LIMIT: 40,
  },

  /** 경쟁사 분석 */
  COMPETITOR: {
    /** 분석 캐시 유효 기간 (일) */
    CACHE_DAYS: 7,
    /** 키워드 최소 등장 횟수 (1 = 모든 서브키워드 수집) */
    MIN_FREQUENCY: 1,
    /** 분석할 경쟁사 상품 수 */
    TOP_PRODUCTS: 40,
  },

  /** 인기도 단계별 허용 경쟁강도 */
  COMPETITION_FILTER: {
    /** 극초반: LOW만 허용 */
    EXTREME_EARLY: ['LOW'] as const,
    /** 성장기: LOW, MEDIUM 허용 */
    GROWTH: ['LOW', 'MEDIUM'] as const,
    /** 안정기: 전체 허용 */
    STABLE: ['LOW', 'MEDIUM', 'HIGH'] as const,
  },

  /** 검색량 제한 (인기도 단계별) */
  SEARCH_VOLUME_LIMIT: {
    /** 극초반: 검색량 1,000 이하 */
    EXTREME_EARLY: 1000,
    /** 성장기: 검색량 5,000 이하 */
    GROWTH: 5000,
    /** 안정기: 제한 없음 */
    STABLE: Infinity,
  },

  /** 후보 점수 체계 (100점 만점) */
  SCORING: {
    /** 검색량 점수 (0~30) */
    SEARCH_VOLUME: {
      MAX_SCORE: 30,
      /** 적정 검색량 범위 (이 범위일 때 최고 점수) */
      OPTIMAL_RANGE: { MIN: 1000, MAX: 5000 },
    },
    /** 경쟁강도 점수 (0~40) */
    COMPETITION: {
      MAX_SCORE: 40,
      SCORES: {
        LOW: 40,
        MEDIUM: 25,
        HIGH: 10,
      },
    },
    /** 소스 점수 (0~20) */
    SOURCE: {
      MAX_SCORE: 20,
      SCORES: {
        competitor: 20, // 경쟁사 분석 (검증된 키워드)
        search_ad: 15, // 검색광고 연관 키워드
        product_name: 10, // 상품명 토큰화
      },
    },
    /** 신규 보너스 점수 (0~10) */
    NOVELTY: {
      MAX_SCORE: 10,
      /** 실패한 키워드 재발굴 시 감점 */
      FAILED_PENALTY: -20,
    },
  },

  /** 최소 월간 검색량 (이 수치 미만이면 후보에서 제외) */
  MIN_MONTHLY_SEARCH_VOLUME: 1000,

  /** 경고 및 퇴역 기준 */
  WARNING: {
    /** 1페이지 이탈 후 경고 전환 일수 */
    DAYS_OUTSIDE_TOP40: 3,
    /** 경고 상태에서 퇴역 전환 일수 */
    DAYS_IN_WARNING: 7,
  },
} as const;

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
  SHOPPING_API: SHOPPING_API_CONFIG,
  KEYWORD_CLASSIFICATION: KEYWORD_CLASSIFICATION_CONFIG,
  SCORING: SCORING_CONFIG,
  RANKING: RANKING_CONFIG,
  POPULARITY_STAGE: POPULARITY_STAGE_CONFIG,
  KEYWORD_CANDIDATE: KEYWORD_CANDIDATE_CONFIG,
} as const;
