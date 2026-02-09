import 'dotenv/config';
import { Pool } from 'pg';
import axios from 'axios';
import bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID!;
const CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET!;

console.log('=== 네이버 커머스 API (bcrypt 방식) ===\n');
console.log('CLIENT_ID:', CLIENT_ID);
console.log('CLIENT_SECRET:', CLIENT_SECRET);
console.log('');

// bcrypt 방식 서명 생성
function generateSignature(clientId: string, clientSecret: string, timestamp: number): string {
  // 1. password = client_id + "_" + timestamp
  const password = `${clientId}_${timestamp}`;
  console.log('password:', password);

  // 2. bcrypt 해싱 (client_secret을 salt로 사용)
  const hashed = bcrypt.hashSync(password, clientSecret);
  console.log('hashed:', hashed);

  // 3. Base64 인코딩
  const signature = Buffer.from(hashed, 'utf-8').toString('base64');
  console.log('signature:', signature);

  return signature;
}

async function getAccessToken(): Promise<string | null> {
  const timestamp = Date.now();
  console.log('timestamp:', timestamp);
  console.log('');

  const signature = generateSignature(CLIENT_ID, CLIENT_SECRET, timestamp);

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('timestamp', timestamp.toString());
  params.append('client_secret_sign', signature);
  params.append('type', 'SELF');

  console.log('\n요청 파라미터:');
  console.log('  grant_type:', 'client_credentials');
  console.log('  client_id:', CLIENT_ID);
  console.log('  timestamp:', timestamp);
  console.log('  client_secret_sign:', signature);
  console.log('  type:', 'SELF');

  try {
    const response = await axios.post(
      'https://api.commerce.naver.com/external/v1/oauth2/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('\n✅ 토큰 발급 성공!');
    console.log('access_token:', response.data.access_token?.substring(0, 50) + '...');
    return response.data.access_token;
  } catch (error: any) {
    console.log('\n❌ 토큰 발급 실패');
    console.log('에러:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

async function fetchProducts(accessToken: string) {
  // POST /v1/products/search 엔드포인트 사용
  try {
    console.log('  POST /v1/products/search 호출...');
    const response = await axios.post(
      'https://api.commerce.naver.com/external/v1/products/search',
      {
        // 검색 조건 (빈 객체면 전체 조회)
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          page: 1,
          size: 100
        },
      }
    );
    console.log('  ✓ 상품 조회 성공');
    console.log('  응답:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.log('  ✗ 상품 조회 실패');
    console.log('  에러 코드:', error.response?.data?.code);
    console.log('  에러 메시지:', error.response?.data?.message);
    console.log('  상세:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

async function main() {
  // 1. 토큰 발급
  const accessToken = await getAccessToken();
  if (!accessToken) {
    await pool.end();
    return;
  }

  // 2. 상품 조회
  console.log('\n상품 목록 조회 중...');
  const result = await fetchProducts(accessToken);

  if (result?.contents?.length > 0) {
    console.log(`\n상품 ${result.contents.length}개 발견`);

    for (const item of result.contents) {
      // channelProducts 배열에서 상품 정보 추출
      const channelProduct = item.channelProducts?.[0];
      if (!channelProduct) {
        console.log(`  ✗ originProductNo ${item.originProductNo}: channelProducts 없음`);
        continue;
      }

      const productName = channelProduct.name;
      const productId = item.originProductNo?.toString();

      try {
        await pool.query(`
          INSERT INTO products (naver_product_id, product_name, store_name, is_active)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (naver_product_id) DO UPDATE SET
            product_name = EXCLUDED.product_name,
            updated_at = NOW()
        `, [
          productId,
          productName,
          '스마트스토어',
        ]);
        console.log(`  ✓ ${productName}`);
      } catch (err: any) {
        console.error(`  ✗ ${productName}:`, err.message);
      }
    }
  } else {
    console.log('\n상품이 없거나 조회 실패');
  }

  // 결과 확인
  const products = await pool.query('SELECT id, product_name FROM products WHERE is_active = true');
  console.log('\n=== 등록된 상품 ===');
  products.rows.forEach(row => console.log(`  [${row.id}] ${row.product_name}`));

  await pool.end();
}

main().catch(console.error);
