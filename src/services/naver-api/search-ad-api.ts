/**
 * @file search-ad-api.ts
 * @description 네이버 검색광고 API 클라이언트
 * @responsibilities
 * - 키워드 CRUD
 * - 연관 키워드 조회
 * - 성과 데이터 조회
 * - Rate Limiter 적용 (초당 10회)
 */

import { ApiClient, createSearchAdDynamicHeaders } from './api-client';
import { naverSearchAdRateLimiter } from '@/shared/rate-limiter';
import type {
  SearchAdCampaign,
  SearchAdCampaignListResponse,
  SearchAdKeyword,
  SearchAdKeywordListResponse,
  SearchAdKeywordCreateRequest,
  SearchAdKeywordUpdateRequest,
  SearchAdRelatedKeyword,
  SearchAdRelatedKeywordResponse,
  SearchAdKeywordStats,
  SearchAdStatsResponse,
} from '@/types/naver-api.types';

/**
 * compIdx 한국어 → 영어 매핑
 * API 응답: "높음"/"중간"/"낮음" → 코드 내부: "HIGH"/"MEDIUM"/"LOW"
 */
const COMP_IDX_MAP: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  '높음': 'HIGH',
  '중간': 'MEDIUM',
  '낮음': 'LOW',
};

function mapCompIdx(value: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  return COMP_IDX_MAP[value] || 'MEDIUM';
}

/**
 * 검색량 값 안전 파싱
 * API가 낮은 검색량에 "< 10" 같은 문자열을 반환할 수 있음
 */
function parseSearchCount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * 네이버 검색광고 API 클라이언트
 */
export class NaverSearchAdApi {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient(
      'https://api.searchad.naver.com',
      createSearchAdDynamicHeaders()
    );
  }

  /**
   * 캠페인 목록 조회
   */
  async getCampaigns(): Promise<SearchAdCampaign[]> {
    return naverSearchAdRateLimiter.execute(async () => {
      const response = await this.client.get<SearchAdCampaignListResponse>(
        '/ncc/campaigns'
      );
      return response.data;
    });
  }

  /**
   * 키워드 목록 조회
   */
  async getKeywords(params?: {
    nccCampaignId?: string;
    nccAdgroupId?: string;
  }): Promise<SearchAdKeyword[]> {
    return naverSearchAdRateLimiter.execute(async () => {
      const response = await this.client.get<SearchAdKeywordListResponse>(
        '/ncc/keywords',
        params
      );
      return response.data;
    });
  }

  /**
   * 키워드 생성
   */
  async createKeyword(data: SearchAdKeywordCreateRequest): Promise<SearchAdKeyword> {
    return naverSearchAdRateLimiter.execute(async () => {
      const response = await this.client.post<{ data: SearchAdKeyword }>(
        '/ncc/keywords',
        data
      );
      return response.data;
    });
  }

  /**
   * 키워드 수정
   */
  async updateKeyword(
    keywordId: string,
    data: SearchAdKeywordUpdateRequest
  ): Promise<SearchAdKeyword> {
    return naverSearchAdRateLimiter.execute(async () => {
      const response = await this.client.put<{ data: SearchAdKeyword }>(
        `/ncc/keywords/${keywordId}`,
        data
      );
      return response.data;
    });
  }

  /**
   * 키워드 삭제
   */
  async deleteKeyword(keywordId: string): Promise<void> {
    return naverSearchAdRateLimiter.execute(async () => {
      await this.client.delete(`/ncc/keywords/${keywordId}`);
    });
  }

  /**
   * 연관 키워드 조회 (GET /keywordstool)
   * @param keyword 힌트 키워드
   * @returns 연관 키워드 목록 (compIdx는 영어로 변환됨)
   */
  async getRelatedKeywords(keyword: string): Promise<SearchAdRelatedKeyword[]> {
    return naverSearchAdRateLimiter.execute(async () => {
      const response = await this.client.get<SearchAdRelatedKeywordResponse>(
        '/keywordstool',
        { hintKeywords: keyword, showDetail: 1 }
      );

      // 응답 정규화: compIdx 한국어→영어, 검색량 "< 10" → 숫자
      const keywordList = response.keywordList || [];
      return keywordList.map((item) => ({
        ...item,
        monthlyPcQcCnt: parseSearchCount(item.monthlyPcQcCnt),
        monthlyMobileQcCnt: parseSearchCount(item.monthlyMobileQcCnt),
        monthlyAvePcClkCnt: parseSearchCount(item.monthlyAvePcClkCnt),
        monthlyAveMobileClkCnt: parseSearchCount(item.monthlyAveMobileClkCnt),
        compIdx: mapCompIdx(item.compIdx as unknown as string),
      }));
    });
  }

  /**
   * 키워드별 성과 데이터 조회
   */
  async getKeywordStats(params: {
    keywordIds?: string[]; // 키워드 ID 목록
    startDate: string; // YYYYMMDD
    endDate: string; // YYYYMMDD
  }): Promise<SearchAdKeywordStats[]> {
    return naverSearchAdRateLimiter.execute(async () => {
      const response = await this.client.get<SearchAdStatsResponse>(
        '/ncc/stats/keywords',
        {
          ...params,
          ids: params.keywordIds?.join(','),
        }
      );
      return response.data || [];
    });
  }

  /**
   * 단일 키워드 성과 조회
   */
  async getKeywordStatById(
    keywordId: string,
    startDate: string,
    endDate: string
  ): Promise<SearchAdKeywordStats[]> {
    return this.getKeywordStats({
      keywordIds: [keywordId],
      startDate,
      endDate,
    });
  }
}

/**
 * 싱글톤 인스턴스
 */
export const searchAdApi = new NaverSearchAdApi();
