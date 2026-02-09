import 'dotenv/config';
import axios from 'axios';

const CLIENT_ID = process.env.NAVER_SHOPPING_CLIENT_ID!;
const CLIENT_SECRET = process.env.NAVER_SHOPPING_CLIENT_SECRET!;

// 우리 상품 정보
const MY_PRODUCT_NAME = '볼펜, 퀵드라이 젤펜';
const MY_MALL_NAME = '봄날의서재';

interface ShoppingItem {
  title: string;
  link: string;
  lprice: string;
  mallName: string;
  productId: string;
  maker: string;
  brand: string;
}

async function searchShopping(query: string, display: number = 100, start: number = 1): Promise<ShoppingItem[]> {
  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/shop.json', {
      headers: {
        'X-Naver-Client-Id': CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
      },
      params: {
        query,
        display,
        start,
        sort: 'sim', // 정확도순
      },
    });
    return response.data.items || [];
  } catch (error: any) {
    console.error(`검색 실패 (${query}):`, error.response?.data || error.message);
    return [];
  }
}

async function findProductRanking(keyword: string, maxPages: number = 10) {
  console.log(`\n🔍 "${keyword}" 검색 중... (스토어: ${MY_MALL_NAME})`);

  let foundRank = -1;
  let foundItem: ShoppingItem | null = null;

  for (let page = 0; page < maxPages; page++) {
    const start = page * 100 + 1;
    if (start > 1000) break; // API 한계: start 최대 1000

    const items = await searchShopping(keyword, 100, start);

    if (items.length === 0) {
      console.log(`  페이지 ${page + 1}: 결과 없음`);
      break;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rank = start + i;
      const titleClean = item.title.replace(/<[^>]*>/g, ''); // HTML 태그 제거

      // 우리 스토어 상품인지 확인
      if (item.mallName === MY_MALL_NAME || item.mallName.includes('봄날')) {
        console.log(`  ✅ [${rank}위] ${titleClean}`);
        console.log(`        가격: ${item.lprice}원 | 쇼핑몰: ${item.mallName}`);

        if (foundRank === -1) {
          foundRank = rank;
          foundItem = item;
        }
      }
    }

    // 찾았으면 더 검색할 필요 없음
    if (foundRank > 0) {
      console.log(`  → ${foundRank}위에서 발견!`);
      break;
    }

    console.log(`  페이지 ${page + 1} (${start}~${start + items.length - 1}위) - 미발견`);

    // API 호출 간격
    await new Promise(r => setTimeout(r, 200));
  }

  if (foundRank === -1) {
    console.log(`  → 1000위 내 미발견`);
  }

  return { rank: foundRank, item: foundItem };
}

async function main() {
  console.log('=== 네이버 쇼핑 순위 검색 ===\n');
  console.log('CLIENT_ID:', CLIENT_ID);
  console.log('');

  // 검색할 키워드 목록
  const keywords = [
    '볼펜',
    '젤펜',
    '중성펜',
    '퀵드라이 젤펜',
    '선물용 볼펜',
    '그립감 좋은 펜',
  ];

  const results: { keyword: string; rank: number }[] = [];

  for (const keyword of keywords) {
    const { rank } = await findProductRanking(keyword, 10); // 최대 1000위까지
    results.push({ keyword, rank });

    // API 호출 제한 방지
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== 검색 결과 요약 ===');
  for (const { keyword, rank } of results) {
    if (rank > 0) {
      console.log(`  "${keyword}": ${rank}위`);
    } else {
      console.log(`  "${keyword}": 1000위 밖 또는 미노출`);
    }
  }
}

main().catch(console.error);
