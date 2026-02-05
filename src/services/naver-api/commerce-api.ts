/**
 * @file commerce-api.ts
 * @description 네이버 커머스 API 클라이언트
 * @responsibilities
 * - 상품 조회/수정
 * - 태그 검색
 * - 주문/매출 데이터 조회
 * - Rate Limiter 적용 (초당 2회)
 */

import { ApiClient, createCommerceAuthHeaders } from './api-client';
import { naverCommerceRateLimiter } from '@/shared/rate-limiter';
import type {
  CommerceProductListResponse,
  CommerceProductResponse,
  CommerceProduct,
  CommerceTagSearchResponse,
  CommerceOrderListResponse,
} from '@/types/naver-api.types';

/**
 * 네이버 커머스 API 클라이언트
 */
export class NaverCommerceApi {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient(
      'https://api.commerce.naver.com',
      createCommerceAuthHeaders()
    );
  }

  /**
   * 상품 목록 조회
   */
  async getProducts(params?: {
    page?: number;
    size?: number;
  }): Promise<CommerceProduct[]> {
    return naverCommerceRateLimiter.execute(async () => {
      const response = await this.client.get<CommerceProductListResponse>(
        '/external/v1/products',
        params
      );
      return response.data.products;
    });
  }

  /**
   * 상품 상세 조회
   */
  async getProduct(productId: string): Promise<CommerceProduct> {
    return naverCommerceRateLimiter.execute(async () => {
      const response = await this.client.get<CommerceProductResponse>(
        `/external/v1/products/${productId}`
      );
      return response.data;
    });
  }

  /**
   * 상품 수정
   */
  async updateProduct(
    productId: string,
    data: {
      name?: string;
      tags?: string[];
      categoryId?: string;
    }
  ): Promise<CommerceProduct> {
    return naverCommerceRateLimiter.execute(async () => {
      const response = await this.client.put<CommerceProductResponse>(
        `/external/v1/products/${productId}`,
        data
      );
      return response.data;
    });
  }

  /**
   * 추천 태그 검색 (자동완성)
   */
  async searchTags(keyword: string): Promise<Array<{ id: string; name: string }>> {
    return naverCommerceRateLimiter.execute(async () => {
      const response = await this.client.get<CommerceTagSearchResponse>(
        '/external/v1/tags/search',
        { keyword }
      );
      return response.data.tags;
    });
  }

  /**
   * 주문 내역 조회
   */
  async getOrders(params: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
  }): Promise<any[]> {
    return naverCommerceRateLimiter.execute(async () => {
      const response = await this.client.get<CommerceOrderListResponse>(
        '/external/v1/orders',
        params
      );
      return response.data.orders;
    });
  }

  /**
   * 상품별 성과 데이터 조회 (주문 기반)
   */
  async getProductStats(
    productId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    orders: number;
    sales: number;
    views: number;
  }> {
    return naverCommerceRateLimiter.execute(async () => {
      // 주문 데이터에서 해당 상품 필터링
      const orders = await this.getOrders({ startDate, endDate });
      const productOrders = orders.filter((order) => order.productId === productId);

      return {
        orders: productOrders.length,
        sales: productOrders.reduce((sum, order) => sum + order.totalPaymentAmount, 0),
        views: 0, // 추후 통계 API 연동
      };
    });
  }
}

/**
 * 싱글톤 인스턴스
 */
export const commerceApi = new NaverCommerceApi();
