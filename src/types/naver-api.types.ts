/**
 * @file naver-api.types.ts
 * @description 네이버 API 타입 정의
 * @responsibilities
 * - 네이버 커머스 API 응답 타입
 * - 네이버 검색광고 API 응답 타입
 * - 공통 타입
 */

// ============================================
// 공통 타입
// ============================================

export interface NaverApiError {
  code: string;
  message: string;
  detail?: string;
}

export interface Pagination {
  page: number;
  size: number;
  total: number;
}

// ============================================
// 커머스 API 타입
// ============================================

export interface CommerceProduct {
  id: string;
  name: string;
  salePrice: number;
  stockQuantity: number;
  statusType: 'SALE' | 'SOLD_OUT' | 'SUSPENSION';
  category: {
    id: string;
    name: string;
  };
  tags?: string[];
  images?: Array<{
    url: string;
  }>;
}

export interface CommerceProductListResponse {
  data: {
    products: CommerceProduct[];
    pagination?: Pagination;
  };
}

export interface CommerceProductResponse {
  data: CommerceProduct;
}

export interface CommerceTag {
  id: string;
  name: string;
}

export interface CommerceTagSearchResponse {
  data: {
    tags: CommerceTag[];
  };
}

export interface CommerceOrder {
  orderId: string;
  productOrderId: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPaymentAmount: number;
  orderDate: string;
}

export interface CommerceOrderListResponse {
  data: {
    orders: CommerceOrder[];
  };
}

// ============================================
// 검색광고 API 타입
// ============================================

export interface SearchAdCampaign {
  nccCampaignId: string;
  campaignName: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  dailyBudget: number;
}

export interface SearchAdCampaignListResponse {
  data: SearchAdCampaign[];
}

export interface SearchAdKeyword {
  nccKeywordId: string;
  keyword: string;
  nccCampaignId: string;
  bidAmt: number; // 입찰가
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  useGroupBidAmt: boolean;
}

export interface SearchAdKeywordListResponse {
  data: SearchAdKeyword[];
}

export interface SearchAdKeywordCreateRequest {
  nccCampaignId: string;
  nccAdgroupId: string;
  keyword: string;
  bidAmt: number;
}

export interface SearchAdKeywordUpdateRequest {
  bidAmt?: number;
  status?: 'ACTIVE' | 'PAUSED';
}

export interface SearchAdRelatedKeyword {
  relKeyword: string; // 연관 키워드
  monthlyPcQcCnt: number; // 월간 PC 검색수
  monthlyMobileQcCnt: number; // 월간 모바일 검색수
  monthlyAvePcClkCnt: number; // 월간 평균 PC 클릭수
  monthlyAveMobileClkCnt: number; // 월간 평균 모바일 클릭수
  monthlyAvePcCtr: number; // 월간 평균 PC 클릭률
  monthlyAveMobileCtr: number; // 월간 평균 모바일 클릭률
  plAvgDepth: number; // 경쟁 강도
  compIdx: 'LOW' | 'MEDIUM' | 'HIGH'; // 경쟁 지수
}

export interface SearchAdRelatedKeywordResponse {
  keywordList: SearchAdRelatedKeyword[];
}

export interface SearchAdStats {
  impCnt: number; // 노출수
  clkCnt: number; // 클릭수
  salesAmt: number; // 전환 매출
  ctr: number; // 클릭률
  avgCpc: number; // 평균 클릭 비용
  ccnt: number; // 전환수
  cost: number; // 비용
}

export interface SearchAdKeywordStats extends SearchAdStats {
  nccKeywordId: string;
  date: string;
}

export interface SearchAdStatsResponse {
  data: SearchAdKeywordStats[];
}
