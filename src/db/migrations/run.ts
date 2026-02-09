/**
 * @file run.ts
 * @description 데이터베이스 마이그레이션 실행 스크립트
 * @responsibilities
 * - schema.sql 또는 특정 마이그레이션 파일 실행
 * - 마이그레이션 결과 출력
 *
 * @usage
 * - npm run db:migrate              # schema.sql 실행
 * - npm run db:migrate -- 003       # 003-*.sql 파일 실행
 * - npm run db:migrate -- all       # migrations/ 폴더 전체 실행
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from '../client';

const MIGRATIONS_DIR = __dirname;

async function runMigration() {
  const arg = process.argv[2];

  console.log('🚀 Starting database migration...\n');

  try {
    if (arg === 'all') {
      // 모든 마이그레이션 파일 실행 (숫자 순서)
      await runAllMigrations();
    } else if (arg) {
      // 특정 마이그레이션 파일 실행
      await runSpecificMigration(arg);
    } else {
      // 기본: schema.sql 실행
      await runSchemaFile();
    }

    // 생성된 테이블 확인
    await listTables();

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

/**
 * schema.sql 실행 (기본)
 */
async function runSchemaFile() {
  const schemaPath = join(__dirname, '..', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  console.log('📄 Executing schema.sql...');
  await db.query(schema);
  console.log('✓ Schema executed successfully\n');
}

/**
 * 특정 마이그레이션 파일 실행
 */
async function runSpecificMigration(pattern: string) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && f.includes(pattern))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migration file found matching: ${pattern}`);
  }

  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`📄 Executing ${file}...`);

    // 먼저 전체 파일을 한 번에 실행 시도
    try {
      await db.query(sql);
      console.log(`✓ ${file} executed successfully\n`);
      continue;
    } catch (error: any) {
      // 이미 존재하는 객체 에러면 개별 실행으로 전환
      if (
        error.code === '42P07' || // relation already exists
        error.code === '42710' || // object already exists
        error.code === '23505'    // duplicate key
      ) {
        console.log(`  ℹ Some objects exist, running statements individually...`);
      } else {
        throw error;
      }
    }

    // 개별 statement 실행 (일부만 실패한 경우)
    // -- 로 시작하는 주석 블록 제거 후 세미콜론으로 분리
    const cleanedSql = sql.replace(/--[^\n]*\n/g, '\n');
    const statements = cleanedSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await db.query(statement);
      } catch (error: any) {
        // 이미 존재하는 객체 에러는 무시
        if (
          error.code === '42P07' || // relation already exists
          error.code === '42710' || // object already exists
          error.code === '23505'    // duplicate key
        ) {
          console.log(`  ⚠ Skipped (already exists): ${error.message.split('\n')[0]}`);
        } else {
          throw error;
        }
      }
    }

    console.log(`✓ ${file} executed successfully\n`);
  }
}

/**
 * 모든 마이그레이션 파일 실행 (숫자 순서)
 */
async function runAllMigrations() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && /^\d{3}/.test(f))
    .sort();

  console.log(`📦 Found ${files.length} migration files\n`);

  for (const file of files) {
    await runSpecificMigration(file);
  }
}

/**
 * 테이블 목록 출력
 */
async function listTables() {
  const tables = await db.queryMany<{ tablename: string }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log('📊 Current tables:');
  tables.forEach((table) => {
    console.log(`  - ${table.tablename}`);
  });
}

// 실행
runMigration();
