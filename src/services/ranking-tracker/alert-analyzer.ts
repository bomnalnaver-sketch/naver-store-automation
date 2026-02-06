/**
 * @file alert-analyzer.ts
 * @description 순위 변동 분석 및 알림 생성 서비스
 * @responsibilities
 * - 전일 대비 순위 변동 분석
 * - 알림 타입 판별 (SURGE / DROP / ENTER / EXIT)
 * - 인기도 급변 감지
 * - 알림 DB 저장 및 조회/읽음 처리
 */

import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { RANKING_CONFIG, POPULARITY_STAGE_CONFIG } from '@/config/app-config';
import { RankAlert, RankAlertType } from '@/types/keyword.types';

/** DB에서 조회한 일일 순위 행 타입 */
interface DailyRankRow {
  keyword: string;
  rank: number | null;
}

/** DB에서 조회한 알림 행 타입 */
interface AlertRow {
  id: number;
  product_id: string;
  keyword: string;
  prev_rank: number | null;
  curr_rank: number | null;
  change_amount: number;
  alert_type: RankAlertType;
  is_read: boolean;
  created_at: Date;
}

/**
 * 특정 상품의 특정 날짜 순위 변동을 분석하여 알림 생성
 * 전일 순위와 당일 순위를 비교하여 SURGE/DROP/ENTER/EXIT 판별
 * @param productId 네이버 쇼핑 상품 ID
 * @param date 분석 기준 날짜
 * @returns 생성된 알림 배열
 */
export async function analyzeRankChanges(
  productId: string,
  date: Date
): Promise<RankAlert[]> {
  const dateStr = date.toISOString().split('T')[0];

  // 오늘 순위 조회
  const todayRanks = await db.queryMany<DailyRankRow>(
    `SELECT keyword, rank
     FROM keyword_ranking_daily
     WHERE product_id = $1
       AND DATE(checked_at) = $2`,
    [productId, dateStr]
  );

  // 전일 날짜 계산
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  // 전일 순위 조회
  const prevRanks = await db.queryMany<DailyRankRow>(
    `SELECT keyword, rank
     FROM keyword_ranking_daily
     WHERE product_id = $1
       AND DATE(checked_at) = $2`,
    [productId, prevDateStr]
  );

  // 전일 순위를 키워드별 Map으로 변환
  const prevRankMap = new Map<string, number | null>();
  for (const row of prevRanks) {
    prevRankMap.set(row.keyword, row.rank);
  }

  const alerts: RankAlert[] = [];
  const threshold = RANKING_CONFIG.RANK_CHANGE_ALERT_THRESHOLD;

  for (const todayRow of todayRanks) {
    const { keyword, rank: currRank } = todayRow;
    const prevRank = prevRankMap.has(keyword) ? prevRankMap.get(keyword)! : undefined;

    // 전일 데이터가 없으면 비교 불가, 건너뜀
    if (prevRank === undefined) {
      continue;
    }

    const alertType = determineAlertType(prevRank, currRank, threshold);

    if (alertType === null) {
      continue;
    }

    // changeAmount: prevRank - currRank (양수=상승, 음수=하락)
    const changeAmount = calculateChangeAmount(prevRank, currRank);

    alerts.push({
      productId,
      keyword,
      prevRank,
      currRank,
      changeAmount,
      alertType,
    });
  }

  logger.debug('순위 변동 분석 완료', {
    productId,
    date: dateStr,
    totalKeywords: todayRanks.length,
    alertCount: alerts.length,
  });

  return alerts;
}

/**
 * 전일/당일 순위를 비교하여 알림 타입 결정
 * @param prevRank 전일 순위 (null=순위권 밖)
 * @param currRank 당일 순위 (null=순위권 밖)
 * @param threshold 알림 기준 변동폭
 * @returns 알림 타입 또는 null (알림 불필요)
 */
function determineAlertType(
  prevRank: number | null,
  currRank: number | null,
  threshold: number
): RankAlertType | null {
  // ENTER: 전일 순위권 밖 -> 오늘 순위권 진입
  if (prevRank === null && currRank !== null) {
    return 'ENTER';
  }

  // EXIT: 전일 순위 있음 -> 오늘 순위권 이탈
  if (prevRank !== null && currRank === null) {
    return 'EXIT';
  }

  // 둘 다 null이면 변동 없음
  if (prevRank === null || currRank === null) {
    return null;
  }

  // 순위 변동 계산 (양수=상승, 음수=하락)
  const change = prevRank - currRank;

  // SURGE: 순위 상승(숫자 감소)이 threshold 이상
  if (change >= threshold) {
    return 'SURGE';
  }

  // DROP: 순위 하락(숫자 증가)이 threshold 이상
  if (change <= -threshold) {
    return 'DROP';
  }

  return null;
}

/**
 * 순위 변동량 계산
 * prevRank - currRank (양수=상승, 음수=하락)
 * ENTER/EXIT의 경우 currRank 또는 prevRank를 그대로 사용
 * @param prevRank 전일 순위
 * @param currRank 당일 순위
 * @returns 변동량
 */
function calculateChangeAmount(
  prevRank: number | null,
  currRank: number | null
): number {
  if (prevRank === null && currRank !== null) {
    // ENTER: 순위권 진입 -> currRank를 양수로 표현
    return currRank;
  }

  if (prevRank !== null && currRank === null) {
    // EXIT: 순위권 이탈 -> prevRank를 음수로 표현
    return -prevRank;
  }

  if (prevRank !== null && currRank !== null) {
    return prevRank - currRank;
  }

  return 0;
}

/**
 * 인기도 급변 감지
 * SURGE 타입 알림 중 변동량이 SURGE_DETECTION_THRESHOLD 이상인 경우 감지
 * @param productId 상품 ID (로깅용)
 * @param alerts 분석된 알림 배열
 * @returns 급변 감지 여부
 */
export function detectPopularitySurge(
  productId: string,
  alerts: RankAlert[]
): boolean {
  const surgeThreshold = POPULARITY_STAGE_CONFIG.SURGE_DETECTION_THRESHOLD;

  const hasSurge = alerts.some(
    (alert) =>
      alert.alertType === 'SURGE' && alert.changeAmount >= surgeThreshold
  );

  if (hasSurge) {
    logger.info('인기도 급변 감지', { productId, surgeThreshold });
  }

  return hasSurge;
}

/**
 * 알림 목록을 keyword_ranking_alerts 테이블에 저장
 * @param alerts 저장할 알림 배열
 */
export async function saveAlerts(alerts: RankAlert[]): Promise<void> {
  if (alerts.length === 0) return;

  await db.transaction(async (client) => {
    for (const alert of alerts) {
      await client.query(
        `INSERT INTO keyword_ranking_alerts
           (product_id, keyword, prev_rank, curr_rank, change_amount, alert_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          alert.productId,
          alert.keyword,
          alert.prevRank,
          alert.currRank,
          alert.changeAmount,
          alert.alertType,
        ]
      );
    }
  });

  logger.info('순위 변동 알림 저장 완료', { count: alerts.length });
}

/**
 * 읽지 않은 알림 목록 조회
 * @param productId 상품 ID (선택, 미지정 시 전체 조회)
 * @returns 미읽음 알림 배열
 */
export async function getUnreadAlerts(
  productId?: string
): Promise<RankAlert[]> {
  const baseQuery = `
    SELECT product_id, keyword, prev_rank, curr_rank, change_amount, alert_type
    FROM keyword_ranking_alerts
    WHERE is_read = false`;

  if (productId) {
    const rows = await db.queryMany<AlertRow>(
      `${baseQuery} AND product_id = $1 ORDER BY created_at DESC`,
      [productId]
    );
    return rows.map(mapAlertRowToRankAlert);
  }

  const rows = await db.queryMany<AlertRow>(
    `${baseQuery} ORDER BY created_at DESC`
  );
  return rows.map(mapAlertRowToRankAlert);
}

/**
 * 알림 읽음 처리
 * @param alertIds 읽음 처리할 알림 ID 배열
 */
export async function markAlertsAsRead(alertIds: number[]): Promise<void> {
  if (alertIds.length === 0) return;

  await db.query(
    `UPDATE keyword_ranking_alerts
     SET is_read = true
     WHERE id = ANY($1)`,
    [alertIds]
  );

  logger.debug('알림 읽음 처리 완료', { count: alertIds.length });
}

/**
 * DB 알림 행을 RankAlert 타입으로 변환
 * @param row DB 행 데이터
 * @returns RankAlert 객체
 */
function mapAlertRowToRankAlert(row: AlertRow): RankAlert {
  return {
    productId: row.product_id,
    keyword: row.keyword,
    prevRank: row.prev_rank,
    currRank: row.curr_rank,
    changeAmount: row.change_amount,
    alertType: row.alert_type,
  };
}
