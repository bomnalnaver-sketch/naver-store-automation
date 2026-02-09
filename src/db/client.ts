/**
 * @file client.ts
 * @description PostgreSQL 데이터베이스 클라이언트
 * @responsibilities
 * - DB 연결 풀 관리
 * - 쿼리 실행
 * - 트랜잭션 관리
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '@/config/env';
import { DB_CONFIG } from '@/config/app-config';

/**
 * PostgreSQL 연결 풀
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: DB_CONFIG.MAX_POOL_SIZE,
  connectionTimeoutMillis: DB_CONFIG.CONNECTION_TIMEOUT,
  idleTimeoutMillis: 30000,
  allowExitOnIdle: false,
});

/**
 * 연결 풀 에러 핸들링
 */
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * 쿼리 실행
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      console.warn(`Slow query detected (${duration}ms):`, text);
    }

    return result;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * 트랜잭션 실행
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 단일 행 조회
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * 다중 행 조회
 */
export async function queryMany<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * DB 연결 테스트
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    console.log('✓ Database connected:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}

/**
 * 연결 풀 종료
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}

/**
 * DB 클라이언트 객체 (간편 사용)
 */
export const db = {
  query,
  queryOne,
  queryMany,
  transaction,
  testConnection,
  close: closePool,
};
