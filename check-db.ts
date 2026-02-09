import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    console.log('=== 테스트 상품 데이터 보완 ===\n');

    // store_name 업데이트
    await pool.query(`
      UPDATE products
      SET store_name = '테스트스토어'
      WHERE store_name IS NULL
    `);
    console.log('store_name 업데이트 완료');

    // 결과 확인
    const data = await pool.query('SELECT id, product_name, store_name FROM products');
    console.log('\n현재 상품:');
    data.rows.forEach(row => {
      console.log(`  [${row.id}] ${row.product_name} (${row.store_name})`);
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
