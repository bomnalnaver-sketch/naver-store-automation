/**
 * @file run.ts
 * @description 데이터베이스 마이그레이션 실행 스크립트
 * @responsibilities
 * - schema.sql 실행
 * - 마이그레이션 결과 출력
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../client';

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  try {
    // schema.sql 파일 읽기
    const schemaPath = join(__dirname, '..', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('📄 Executing schema.sql...');

    // 스키마 실행
    await db.query(schema);

    console.log('✓ Schema executed successfully\n');

    // 생성된 테이블 확인
    const tables = await db.queryMany<{ tablename: string }>(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('📊 Created tables:');
    tables.forEach((table) => {
      console.log(`  - ${table.tablename}`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// 실행
runMigration();
