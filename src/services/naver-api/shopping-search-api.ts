/**
 * @file shopping-search-api.ts
 * @description 네이버 쇼핑 검색 API 클라이언트
 * @responsibilities
 * - 쇼핑 검색 쿼리 실행
 * - 키워드별 상위 상품 조회 (색깔 분류용)
 * - 순위 추적용 페이지네이션 검색
 * - Rate Limiter 적용
 */

import { ApiClient, createShoppingSearchAuthHeaders } from './api-client';
import { naverShoppingRateLimiter } from '@/shared/rate-limiter';
import { logger } from '@/utils/logger';
import {
  ShoppingSearchParams,
  ShoppingSearchResponse,
  ShoppingSearchItem,
} from '@/types/shopping-api.types';

const SHOPPING_API_BASE_URL = 'https://openapi.naver.com';

/**
 * 네이버 쇼핑 검색 API 클라이언트
 */
class NaverShoppingSearchApi {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient(
      SHOPPING_API_BASE_URL,
      createShoppingSearchAuthHeaders()
    );
  }

  /**
   * 쇼핑 검색 실행
   */
  async search(params: ShoppingSearchParams): Promise<ShoppingSearchResponse> {
    return naverShoppingRateLimiter.execute(async () => {
      const response = await this.client.get<ShoppingSearchResponse>(
        '/v1/search/shop.json',
        {
          query: params.query,
          display: params.display || 40,
          start: params.start || 1,
          sort: params.sort || 'sim',
          exclude: params.exclude,
        }
      );

      logger.debug('쇼핑 검색 완료', {
        query: params.query,
        total: response.total,
        display: response.display,
        start: response.start,
      });

      return response;
    });
  }

  /**
   * 색깔 분류용 상위 40개 상품 조회
   * display=40, sort=sim, 중고/렌탈/해외직구 제외
   */
  async searchTop40(keyword: string): Promise<ShoppingSearchItem[]> {
    const response = await this.search({
      query: keyword,
      display: 40,
      start: 1,
      sort: 'sim',
      exclude: 'used:rental:cbshop',
    });

    return response.items;
  }

  /**
   * 순위 추적용 페이지네이션 검색
   */
  async searchPage(
    keyword: string,
    start: number,
    display: number = 100
  ): Promise<ShoppingSearchResponse> {
    return this.search({
      query: keyword,
      display,
      start,
      sort: 'sim',
      exclude: 'used:rental:cbshop',
    });
  }

  /**
   * 키워드의 등록상품수(total) 조회
   * 키워드 유형 판별에 사용 (display=1로 최소 호출)
   */
  async getRegisteredProductCount(keyword: string): Promise<number> {
    const response = await this.search({
      query: keyword,
      display: 1,
      start: 1,
      sort: 'sim',
    });

    return response.total;
  }
}

/** 싱글톤 인스턴스 */
export const shoppingSearchApi = new NaverShoppingSearchApi();
