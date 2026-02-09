/**
 * @file brand-blacklist.ts
 * @description 키워드 필터링용 브랜드 블랙리스트
 * @responsibilities
 * - 경쟁사 브랜드명 관리
 * - 일반 불필요 키워드 관리
 * - 동적 블랙리스트 확장 지원
 */

/**
 * 대형 브랜드 블랙리스트
 * - 검색 시 타 브랜드 키워드를 걸러내기 위함
 * - 소문자로 관리하며 비교 시 소문자 변환 후 확인
 */
export const BRAND_BLACKLIST: Set<string> = new Set([
  // 스포츠 브랜드
  '나이키', 'nike',
  '아디다스', 'adidas',
  '퓨마', 'puma',
  '뉴발란스', 'new balance', 'newbalance',
  '리복', 'reebok',
  '컨버스', 'converse',
  '반스', 'vans',
  '언더아머', 'under armour', 'underarmour',
  '아식스', 'asics',
  '미즈노', 'mizuno',
  '휠라', 'fila',
  '스케쳐스', 'skechers',

  // 패션 브랜드
  '구찌', 'gucci',
  '프라다', 'prada',
  '루이비통', 'louis vuitton', 'louisvuitton',
  '샤넬', 'chanel',
  '버버리', 'burberry',
  '발렌시아가', 'balenciaga',
  '자라', 'zara',
  '유니클로', 'uniqlo',
  'h&m', 'hm',

  // 아웃도어 브랜드
  '노스페이스', 'north face', 'northface',
  '파타고니아', 'patagonia',
  '아크테릭스', "arc'teryx", 'arcteryx',
  '컬럼비아', 'columbia',
  '블랙야크', 'blackyak',
  '네파', 'nepa',
  'k2',
  '코오롱', 'kolon',

  // 전자제품 브랜드
  '삼성', 'samsung',
  '애플', 'apple', '아이폰', 'iphone', '아이패드', 'ipad',
  'lg', '엘지',
  '소니', 'sony',
  '샤오미', 'xiaomi',
  '화웨이', 'huawei',

  // 기타 대형 브랜드
  '스타벅스', 'starbucks',
  '맥도날드', 'mcdonalds',
  '코카콜라', 'coca cola', 'cocacola',
]);

/**
 * 무의미한 수식어 블랙리스트
 * - 검색 결과에 의미 없는 영향을 주는 키워드
 */
export const MODIFIER_BLACKLIST: Set<string> = new Set([
  // 가격/할인 관련
  '할인', '세일', '특가', '최저가', '저렴', '싸게',
  '무료배송', '당일배송', '빠른배송',

  // 평가/추천 관련
  '추천', '인기', '베스트', '핫딜', '대박', '최고',
  '1위', '1등', '톱', 'top',

  // 일반 수식어
  '정품', '새상품', '미개봉', '풀박스',
  '고급', '프리미엄', 'premium',

  // 사이즈 (단독 사용 시)
  's', 'm', 'l', 'xl', 'xxl', 'xs',
  '프리사이즈', 'free',
]);

/**
 * 브랜드 블랙리스트 확인
 * @param keyword 확인할 키워드
 * @returns 블랙리스트에 포함 여부
 */
export function isBlacklistedBrand(keyword: string): boolean {
  const lower = keyword.toLowerCase().trim();

  // 정확히 일치하는 경우
  if (BRAND_BLACKLIST.has(lower)) return true;

  // 브랜드명이 키워드에 포함된 경우
  for (const brand of BRAND_BLACKLIST) {
    if (lower.includes(brand) || brand.includes(lower)) {
      // 너무 짧은 브랜드명은 부분 일치 검사 제외 (예: 'k2', 'lg')
      if (brand.length <= 2 && lower !== brand) continue;
      return true;
    }
  }

  return false;
}

/**
 * 무의미한 수식어 확인
 * @param keyword 확인할 키워드
 * @returns 무의미한 수식어 여부
 */
export function isBlacklistedModifier(keyword: string): boolean {
  const lower = keyword.toLowerCase().trim();
  return MODIFIER_BLACKLIST.has(lower);
}

/**
 * 블랙리스트 전체 확인
 * @param keyword 확인할 키워드
 * @returns 블랙리스트 여부 및 이유
 */
export function checkBlacklist(keyword: string): {
  isBlacklisted: boolean;
  reason?: 'brand' | 'modifier';
  matchedTerm?: string;
} {
  const lower = keyword.toLowerCase().trim();

  // 브랜드 체크
  if (BRAND_BLACKLIST.has(lower)) {
    return { isBlacklisted: true, reason: 'brand', matchedTerm: lower };
  }

  // 브랜드 부분 일치 체크
  for (const brand of BRAND_BLACKLIST) {
    if (brand.length > 2 && (lower.includes(brand) || brand.includes(lower))) {
      return { isBlacklisted: true, reason: 'brand', matchedTerm: brand };
    }
  }

  // 수식어 체크
  if (MODIFIER_BLACKLIST.has(lower)) {
    return { isBlacklisted: true, reason: 'modifier', matchedTerm: lower };
  }

  return { isBlacklisted: false };
}

/**
 * 사용자 정의 블랙리스트 추가
 * (런타임에 동적으로 추가 가능)
 */
export function addToBrandBlacklist(brands: string[]): void {
  for (const brand of brands) {
    BRAND_BLACKLIST.add(brand.toLowerCase().trim());
  }
}

export function addToModifierBlacklist(modifiers: string[]): void {
  for (const modifier of modifiers) {
    MODIFIER_BLACKLIST.add(modifier.toLowerCase().trim());
  }
}
