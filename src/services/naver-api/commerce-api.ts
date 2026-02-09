/**
 * @file commerce-api.ts
 * @description 네이버 커머스 API 클라이언트
 * @responsibilities
 * - 상품 조회/수정 (bcrypt 서명 인증)
 * - 태그 검색
 * - 주문/매출 데이터 조회
 * - Rate Limiter 적용 (초당 2회)
 */

import axios from 'axios';
import { createCommerceAuthHeaders } from './api-client';
import { naverCommerceRateLimiter } from '@/shared/rate-limiter';
import { logger } from '@/utils/logger';
// API 응답 타입은 실제 API 구조와 일치하도록 로컬에서 정의

const COMMERCE_API_URL = 'https://api.commerce.naver.com/external';

/** 상품 검색 API 응답 구조 */
interface ProductSearchResponse {
  contents: Array<{
    originProductNo: number;
    channelProducts: Array<{
      originProductNo: number;
      channelProductNo: number;
      name: string;
      statusType: string;
      salePrice: number;
      stockQuantity: number;
      categoryId?: string;
      wholeCategoryName?: string;
    }>;
  }>;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** 외부에서 사용할 상품 타입 (카테고리 포함) */
export interface CommerceProduct {
  originProductNo: number;
  channelProductNo?: number;
  name: string;
  statusType?: string;
  salePrice?: number;
  stockQuantity?: number;
  categoryId?: string;
  wholeCategoryName?: string;
  channelProducts?: Array<{
    originProductNo: number;
    channelProductNo: number;
    name: string;
    categoryId?: string;
    wholeCategoryName?: string;
    statusType?: string;
  }>;
}

/** 주문 상태 변경 내역 응답 */
interface OrderStatusResponse {
  lastChangeStatuses?: Array<{
    productOrderId: string;
    productOrderStatus: string;
    productNo: number;
    totalPaymentAmount: number;
    lastChangedDate: string;
  }>;
  moreSequence?: string;
}

/**
 * 네이버 커머스 API 클라이언트
 */
export class NaverCommerceApi {
  /**
   * 상품 목록 조회 (POST /v1/products/search)
   * 카테고리 정보 포함
   */
  async getProducts(params?: {
    page?: number;
    size?: number;
  }): Promise<CommerceProduct[]> {
    return naverCommerceRateLimiter.execute(async () => {
      const url = `${COMMERCE_API_URL}/v1/products/search?page=${params?.page || 1}&size=${params?.size || 100}`;

      const response = await axios.post<ProductSearchResponse>(
        url,
        {}, // 빈 객체 = 전체 조회
        { headers: createCommerceAuthHeaders() }
      );

      // 응답 구조 유지: contents[] 그대로 반환 (카테고리 정보 포함)
      const products: CommerceProduct[] = (response.data.contents || []).map(item => ({
        originProductNo: item.originProductNo,
        name: item.channelProducts?.[0]?.name || '',
        categoryId: item.channelProducts?.[0]?.categoryId,
        wholeCategoryName: item.channelProducts?.[0]?.wholeCategoryName,
        channelProducts: item.channelProducts,
      }));

      logger.info(`Commerce API 상품 조회: ${products.length}개`);
      return products;
    });
  }

  /**
   * 최근 7일 주문 조회 (주간 판매량용)
   */
  async getWeeklyOrders(): Promise<Array<{
    productOrderId: string;
    productOrderStatus: string;
    productNo: number;
    totalPaymentAmount: number;
  }>> {
    const allOrders: any[] = [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 날짜 포맷: YYYY-MM-DDTHH:mm:ss.sss+09:00
    const formatDate = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000+09:00`;
    };

    let lastChangedFrom = formatDate(weekAgo);
    let hasMore = true;

    while (hasMore) {
      const response = await naverCommerceRateLimiter.execute(async () => {
        const url = `${COMMERCE_API_URL}/v1/pay-order/seller/product-orders/last-changed-statuses`;
        return axios.get<OrderStatusResponse>(url, {
          headers: createCommerceAuthHeaders(),
          params: {
            lastChangedFrom,
            limitCount: 300,
          },
        });
      });

      const data = response.data;

      if (data.lastChangeStatuses && data.lastChangeStatuses.length > 0) {
        allOrders.push(...data.lastChangeStatuses);

        if (data.moreSequence) {
          lastChangedFrom = data.moreSequence;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Rate limit 준수
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    logger.info(`주간 주문 조회: ${allOrders.length}건`);
    return allOrders;
  }

  /**
   * 상품 상세 조회 (GET /v2/products/channel-products/{channelProductNo})
   */
  async getProduct(productId: string): Promise<CommerceProduct> {
    return naverCommerceRateLimiter.execute(async () => {
      const url = `${COMMERCE_API_URL}/v2/products/channel-products/${productId}`;
      const response = await axios.get<any>(url, {
        headers: createCommerceAuthHeaders(),
      });
      return response.data;
    });
  }

  /**
   * 상품 수정 (PUT /v2/products/channel-products/{channelProductNo})
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
      const url = `${COMMERCE_API_URL}/v2/products/channel-products/${productId}`;
      const response = await axios.put<any>(url, data, {
        headers: createCommerceAuthHeaders(),
      });
      return response.data;
    });
  }

  /**
   * 추천 태그 검색 (GET /v2/tags/recommend-tags)
   */
  async searchTags(keyword: string): Promise<Array<{ id: string; name: string }>> {
    return naverCommerceRateLimiter.execute(async () => {
      const url = `${COMMERCE_API_URL}/v2/tags/recommend-tags`;
      const response = await axios.get<any>(url, {
        headers: createCommerceAuthHeaders(),
        params: { keyword },
      });
      return response.data?.tags || response.data?.data?.tags || [];
    });
  }

  /**
   * 주문 내역 조회 (GET /v1/pay-order/seller/product-orders)
   */
  async getOrders(params: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
  }): Promise<any[]> {
    return naverCommerceRateLimiter.execute(async () => {
      const url = `${COMMERCE_API_URL}/v1/pay-order/seller/product-orders`;
      const response = await axios.get<any>(url, {
        headers: createCommerceAuthHeaders(),
        params,
      });
      return response.data?.orders || response.data?.data?.orders || [];
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
    // 주문 데이터에서 해당 상품 필터링
    const orders = await this.getOrders({ startDate, endDate });
    const productOrders = orders.filter((order) => order.productId === productId);

    return {
      orders: productOrders.length,
      sales: productOrders.reduce((sum, order) => sum + order.totalPaymentAmount, 0),
      views: 0, // 추후 통계 API 연동
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
export const commerceApi = new NaverCommerceApi();
