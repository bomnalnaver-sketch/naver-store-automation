import 'dotenv/config';
import axios from 'axios';

const CLIENT_ID = process.env.NAVER_SHOPPING_CLIENT_ID!;
const CLIENT_SECRET = process.env.NAVER_SHOPPING_CLIENT_SECRET!;

async function searchShopping(query: string) {
  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/shop.json', {
      headers: {
        'X-Naver-Client-Id': CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
      },
      params: {
        query,
        display: 100,
        start: 1,
        sort: 'sim',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('검색 실패:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('=== 상품 노출 여부 확인 ===\n');

  // 1. 스토어명으로 검색
  console.log('1. "봄날의서재" 스토어 검색:');
  const storeResult = await searchShopping('봄날의서재');
  if (storeResult) {
    console.log(`   총 ${storeResult.total}개 결과`);
    if (storeResult.items?.length > 0) {
      storeResult.items.slice(0, 5).forEach((item: any, i: number) => {
        const title = item.title.replace(/<[^>]*>/g, '');
        console.log(`   [${i+1}] ${title} | ${item.mallName} | ${item.lprice}원`);
      });
    }
  }

  // 2. 상품명 일부로 검색
  console.log('\n2. "퀵드라이 젤펜 볼펜" 검색:');
  const productResult = await searchShopping('퀵드라이 젤펜 볼펜');
  if (productResult) {
    console.log(`   총 ${productResult.total}개 결과`);
    if (productResult.items?.length > 0) {
      productResult.items.slice(0, 10).forEach((item: any, i: number) => {
        const title = item.title.replace(/<[^>]*>/g, '');
        console.log(`   [${i+1}] ${title}`);
        console.log(`       쇼핑몰: ${item.mallName} | 가격: ${item.lprice}원`);
      });
    }
  }

  // 3. 정확한 상품명으로 검색
  console.log('\n3. "볼펜 퀵드라이 젤펜 중성펜 선물용" 검색:');
  const exactResult = await searchShopping('볼펜 퀵드라이 젤펜 중성펜 선물용');
  if (exactResult) {
    console.log(`   총 ${exactResult.total}개 결과`);
    if (exactResult.items?.length > 0) {
      exactResult.items.slice(0, 10).forEach((item: any, i: number) => {
        const title = item.title.replace(/<[^>]*>/g, '');
        console.log(`   [${i+1}] ${title}`);
        console.log(`       쇼핑몰: ${item.mallName} | 가격: ${item.lprice}원`);
      });
    }
  }

  // 4. 가격대로 필터링 시도 (6500원)
  console.log('\n4. "젤펜 6500" 검색 (가격 힌트):');
  const priceResult = await searchShopping('젤펜 6500');
  if (priceResult) {
    console.log(`   총 ${priceResult.total}개 결과`);
    if (priceResult.items?.length > 0) {
      priceResult.items.slice(0, 5).forEach((item: any, i: number) => {
        const title = item.title.replace(/<[^>]*>/g, '');
        console.log(`   [${i+1}] ${title}`);
        console.log(`       쇼핑몰: ${item.mallName} | 가격: ${item.lprice}원`);
      });
    }
  }
}

main().catch(console.error);
