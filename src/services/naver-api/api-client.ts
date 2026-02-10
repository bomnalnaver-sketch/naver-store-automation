/**
 * @file api-client.ts
 * @description 네이버 API 공통 클라이언트
 * @responsibilities
 * - HTTP 요청 공통 처리
 * - 인증 헤더 생성 (bcrypt 서명 방식)
 * - 에러 핸들링
 * - Rate Limiter + Retry 로직 통합
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '@/config/env';
import { retry } from '@/utils/retry';
import { logger } from '@/utils/logger';

/**
 * 네이버 API 에러 클래스
 */
export class NaverApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public detail?: any
  ) {
    super(message);
    this.name = 'NaverApiError';
  }
}

/**
 * bcrypt 서명 생성
 * 서명: Base64(bcrypt.hashSync(clientId + "_" + timestamp, clientSecret))
 */
function generateBcryptSignature(
  clientId: string,
  clientSecret: string,
  timestamp: number
): string {
  const message = `${clientId}_${timestamp}`;
  // clientSecret을 bcrypt salt로 사용
  const hash = bcrypt.hashSync(message, clientSecret);
  return Buffer.from(hash).toString('base64');
}

/**
 * 커머스 API 인증 헤더 생성 (bcrypt 서명 방식)
 */
export function createCommerceAuthHeaders(): Record<string, string> {
  const clientId = env.NAVER_COMMERCE_CLIENT_ID;
  const clientSecret = env.NAVER_COMMERCE_CLIENT_SECRET;
  const timestamp = Date.now();
  const signature = generateBcryptSignature(clientId, clientSecret, timestamp);

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${signature}`,
    'x-ncp-apigw-timestamp': timestamp.toString(),
    'x-ncp-iam-access-key': clientId,
  };
}

/**
 * 쇼핑 검색 API 인증 헤더 생성
 */
export function createShoppingSearchAuthHeaders(): Record<string, string> {
  return {
    'X-Naver-Client-Id': env.NAVER_SHOPPING_CLIENT_ID,
    'X-Naver-Client-Secret': env.NAVER_SHOPPING_CLIENT_SECRET,
  };
}

/**
 * 검색광고 API HMAC-SHA256 서명 생성
 * message = "{timestamp}.{method}.{uri}"
 */
function generateSearchAdSignature(
  timestamp: number,
  method: string,
  uri: string,
  secretKey: string
): string {
  const message = `${timestamp}.${method}.${uri}`;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * 검색광고 API 동적 인증 헤더 생성 (요청별 HMAC-SHA256 서명)
 * @returns 요청 메서드/URI에 따라 헤더를 생성하는 함수
 */
export function createSearchAdDynamicHeaders(): AuthHeadersFn {
  return (method: string, uri: string) => {
    const timestamp = Date.now();
    const signature = generateSearchAdSignature(
      timestamp,
      method,
      uri,
      env.NAVER_SEARCH_AD_SECRET_KEY
    );

    return {
      'X-API-KEY': env.NAVER_SEARCH_AD_API_KEY,
      'X-Customer': env.NAVER_SEARCH_AD_CUSTOMER_ID.toString(),
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
      'Content-Type': 'application/json',
    };
  };
}

/**
 * 동적 인증 헤더 함수 타입
 * 요청별로 메서드/URI에 따라 헤더를 생성 (HMAC 서명 등)
 */
export type AuthHeadersFn = (method: string, uri: string) => Record<string, string>;

/**
 * API 클라이언트 클래스
 * authHeaders: 정적 헤더 객체 또는 요청별 동적 헤더 함수
 */
export class ApiClient {
  private baseURL: string;
  private authHeaders: Record<string, string> | AuthHeadersFn;

  constructor(baseURL: string, authHeaders: Record<string, string> | AuthHeadersFn) {
    this.baseURL = baseURL;
    this.authHeaders = authHeaders;
  }

  /**
   * HTTP 요청 (Retry 로직 포함)
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const headers = typeof this.authHeaders === 'function'
      ? this.authHeaders(config.method?.toUpperCase() || 'GET', config.url || '')
      : this.authHeaders;

    const fullConfig: AxiosRequestConfig = {
      ...config,
      baseURL: this.baseURL,
      headers: {
        ...headers,
        ...config.headers,
      },
    };

    try {
      const response = await retry<AxiosResponse<T>>(
        () => axios.request<T>(fullConfig),
        {
          maxRetries: 3,
          timeout: 30000,
          onRetry: (error, attempt) => {
            logger.warn(`API request failed, retrying (${attempt}/3)`, {
              url: fullConfig.url,
              method: fullConfig.method,
              error: error.message,
            });
          },
        }
      );

      logger.info(`API request succeeded`, {
        url: fullConfig.url,
        method: fullConfig.method,
        status: response.status,
      });

      return response.data;
    } catch (error: any) {
      logger.error(`API request failed after retries`, {
        url: fullConfig.url,
        method: fullConfig.method,
        error: error.message,
        response: error.response?.data,
      });

      throw new NaverApiError(
        error.response?.data?.message || error.message,
        error.response?.status,
        error.response?.data?.code,
        error.response?.data
      );
    }
  }

  /**
   * GET 요청
   */
  async get<T = any>(url: string, params?: any): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    });
  }

  /**
   * POST 요청
   */
  async post<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
    });
  }

  /**
   * PUT 요청
   */
  async put<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
    });
  }

  /**
   * DELETE 요청
   */
  async delete<T = any>(url: string): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
    });
  }
}
