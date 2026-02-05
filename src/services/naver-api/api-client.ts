/**
 * @file api-client.ts
 * @description 네이버 API 공통 클라이언트
 * @responsibilities
 * - HTTP 요청 공통 처리
 * - 인증 헤더 생성
 * - 에러 핸들링
 * - Rate Limiter + Retry 로직 통합
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
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
 * 커머스 API 인증 헤더 생성
 */
export function createCommerceAuthHeaders(): Record<string, string> {
  return {
    'X-Naver-Client-Id': env.NAVER_COMMERCE_CLIENT_ID,
    'X-Naver-Client-Secret': env.NAVER_COMMERCE_CLIENT_SECRET,
    'Content-Type': 'application/json',
  };
}

/**
 * 검색광고 API 인증 헤더 생성
 */
export function createSearchAdAuthHeaders(): Record<string, string> {
  return {
    'X-API-KEY': env.NAVER_SEARCH_AD_API_KEY,
    'X-SECRET-KEY': env.NAVER_SEARCH_AD_SECRET_KEY,
    'X-Customer-ID': env.NAVER_SEARCH_AD_CUSTOMER_ID.toString(),
    'Content-Type': 'application/json',
  };
}

/**
 * API 클라이언트 클래스
 */
export class ApiClient {
  private baseURL: string;
  private authHeaders: Record<string, string>;

  constructor(baseURL: string, authHeaders: Record<string, string>) {
    this.baseURL = baseURL;
    this.authHeaders = authHeaders;
  }

  /**
   * HTTP 요청 (Retry 로직 포함)
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const fullConfig: AxiosRequestConfig = {
      ...config,
      baseURL: this.baseURL,
      headers: {
        ...this.authHeaders,
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
