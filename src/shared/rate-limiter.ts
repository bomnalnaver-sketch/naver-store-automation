/**
 * @file rate-limiter.ts
 * @description API Rate Limiter - API 호출 속도 제한
 * @responsibilities
 * - 초당 최대 요청 수 제한
 * - 큐 기반 요청 관리
 * - 네이버 커머스 API 초당 2회 제한 준수
 */

/**
 * Rate Limiter 클래스
 * 토큰 버킷 알고리즘 사용
 */
export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // 초당 토큰 생성 수

  /**
   * @param maxRequestsPerSecond 초당 최대 요청 수
   * @param buffer 안전 마진 (0~1, 기본 0.9)
   */
  constructor(maxRequestsPerSecond: number, buffer: number = 0.9) {
    this.maxTokens = maxRequestsPerSecond * buffer;
    this.refillRate = maxRequestsPerSecond * buffer;
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * 토큰 리필
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000; // 초 단위
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * 요청 실행 (토큰 사용)
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 토큰 리필
    this.refillTokens();

    // 토큰이 있으면 즉시 실행
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return fn();
    }

    // 토큰이 없으면 대기
    await this.waitForToken();
    this.tokens -= 1;
    return fn();
  }

  /**
   * 토큰 대기
   */
  private waitForToken(): Promise<void> {
    return new Promise((resolve) => {
      const checkToken = () => {
        this.refillTokens();
        if (this.tokens >= 1) {
          resolve();
        } else {
          // 다음 토큰까지 대기 시간 계산
          const waitTime = ((1 - this.tokens) / this.refillRate) * 1000;
          setTimeout(checkToken, Math.max(waitTime, 100));
        }
      };
      checkToken();
    });
  }

  /**
   * 현재 사용 가능한 토큰 수
   */
  getAvailableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }
}

/**
 * 네이버 커머스 API Rate Limiter 싱글톤
 * 초당 2회 제한 (안전 마진 적용 시 1.8회)
 */
export const naverCommerceRateLimiter = new RateLimiter(2, 0.9);

/**
 * 네이버 검색광고 API Rate Limiter 싱글톤
 * 초당 10회 제한 (안전 마진 적용 시 9회)
 */
export const naverSearchAdRateLimiter = new RateLimiter(10, 0.9);

/**
 * 네이버 쇼핑 검색 API Rate Limiter 싱글톤
 * 초당 10회 제한 (안전 마진 적용 시 9회)
 * 주의: 일일 25,000회 한도는 ApiBudgetTracker에서 별도 관리
 */
export const naverShoppingRateLimiter = new RateLimiter(10, 0.9);

/**
 * Rate Limiter 적용 데코레이터
 */
export function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>
): Promise<T> {
  return rateLimiter.execute(fn);
}
