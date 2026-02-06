/**
 * @file formatters.ts
 * @description 공통 포맷팅 유틸리티
 * @responsibilities
 * - 숫자, 날짜, 퍼센트 등 표시 포맷
 */

/** 숫자를 콤마 포맷으로 변환 (예: 1234567 → "1,234,567") */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '-';
  return value.toLocaleString('ko-KR');
}

/** 금액 포맷 (예: 1234567 → "1,234,567원") */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 퍼센트 포맷 (예: 85.123 → "85.1%") */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '-';
  return `${value.toFixed(decimals)}%`;
}

/** 순위 포맷 (null이면 "순위권 밖") */
export function formatRank(rank: number | null | undefined): string {
  if (rank == null) return '순위권 밖';
  return `${rank}위`;
}

/** 날짜 포맷 (YYYY-MM-DD → "MM월 DD일") */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 날짜 포맷 (YYYY-MM-DD → "YYYY.MM.DD") */
export function formatDateFull(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** 상대 시간 (예: "3분 전", "2시간 전", "어제") */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 30) return `${days}일 전`;

  const months = Math.floor(days / 30);
  return `${months}개월 전`;
}

/** ROAS 색상 클래스 반환 */
export function getRoasColorClass(roas: number | null | undefined): string {
  if (roas == null) return 'text-muted-foreground';
  if (roas >= 300) return 'text-green-600 dark:text-green-400';
  if (roas >= 100) return 'text-blue-600 dark:text-blue-400';
  return 'text-red-600 dark:text-red-400';
}

/** 순위 변동 색상 클래스 반환 */
export function getRankChangeColorClass(change: number): string {
  if (change > 0) return 'text-green-600 dark:text-green-400';
  if (change < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}
