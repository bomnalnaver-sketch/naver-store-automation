/**
 * @file logger.ts
 * @description 로깅 유틸리티
 * @responsibilities
 * - 구조화된 로깅
 * - 로그 레벨 관리
 * - 파일 로깅 (선택)
 */

import { LOG_CONFIG } from '@/config/app-config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

/**
 * 로그 레벨 우선순위
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 현재 설정된 로그 레벨
 */
const currentLogLevel = LOG_CONFIG.LEVEL as LogLevel;

/**
 * 로그 출력 여부 확인
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

/**
 * 로그 포맷팅
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);

  let logMessage = `[${timestamp}] ${levelStr} ${message}`;

  if (context && Object.keys(context).length > 0) {
    logMessage += ` ${JSON.stringify(context)}`;
  }

  return logMessage;
}

/**
 * Debug 로그
 */
export function debug(message: string, context?: LogContext): void {
  if (!shouldLog('debug')) return;
  console.log(formatLog('debug', message, context));
}

/**
 * Info 로그
 */
export function info(message: string, context?: LogContext): void {
  if (!shouldLog('info')) return;
  console.log(formatLog('info', message, context));
}

/**
 * Warning 로그
 */
export function warn(message: string, context?: LogContext): void {
  if (!shouldLog('warn')) return;
  console.warn(formatLog('warn', message, context));
}

/**
 * Error 로그
 */
export function error(message: string, errorOrContext?: Error | LogContext): void {
  if (!shouldLog('error')) return;

  let context: LogContext = {};

  if (errorOrContext instanceof Error) {
    context = {
      error: errorOrContext.message,
      stack: errorOrContext.stack,
    };
  } else if (errorOrContext) {
    context = errorOrContext;
  }

  console.error(formatLog('error', message, context));
}

/**
 * Logger 객체
 */
export const logger = {
  debug,
  info,
  warn,
  error,
};
