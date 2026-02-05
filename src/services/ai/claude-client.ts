/**
 * @file claude-client.ts
 * @description Claude API 클라이언트
 * @responsibilities
 * - Anthropic SDK를 사용한 Claude API 호출
 * - 프롬프트 실행 및 응답 파싱
 * - JSON 응답 검증
 * - 에러 핸들링 및 재시도
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/config/env';
import { AI_CONFIG } from '@/config/app-config';
import { retry } from '@/utils/retry';
import { logger } from '@/utils/logger';
import type { ClaudeMessage, ClaudeResponse } from '@/types/ai.types';

/**
 * Claude API 에러 클래스
 */
export class ClaudeApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public type?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ClaudeApiError';
  }
}

/**
 * Claude API 클라이언트
 */
export class ClaudeClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: env.CLAUDE_API_KEY,
    });
  }

  /**
   * 프롬프트 분석 (구조화된 응답 반환)
   * @template T - 기대되는 응답 타입
   * @param prompt - 사용자 프롬프트
   * @param systemPrompt - 시스템 프롬프트 (선택)
   * @returns 파싱된 JSON 응답
   */
  async analyze<T = any>(prompt: string, systemPrompt?: string): Promise<T> {
    const startTime = Date.now();

    try {
      logger.info('Calling Claude API for analysis', {
        promptLength: prompt.length,
        hasSystemPrompt: !!systemPrompt,
      });

      const response = await retry<Anthropic.Message>(
        async () => {
          return await this.client.messages.create({
            model: AI_CONFIG.MODEL,
            max_tokens: AI_CONFIG.MAX_TOKENS,
            temperature: AI_CONFIG.TEMPERATURE,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          });
        },
        {
          maxRetries: 3,
          timeout: AI_CONFIG.TIMEOUT,
          onRetry: (error, attempt) => {
            logger.warn(`Claude API request failed, retrying (${attempt}/3)`, {
              error: error.message,
            });
          },
        }
      );

      const executionTime = Date.now() - startTime;

      // 텍스트 콘텐츠 추출
      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n');

      logger.info('Claude API response received', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        executionTimeMs: executionTime,
        responseLength: textContent.length,
      });

      // JSON 파싱 시도
      try {
        const parsed = this.parseJsonResponse<T>(textContent);
        return parsed;
      } catch (parseError) {
        logger.error('Failed to parse Claude response as JSON', {
          response: textContent,
          error: parseError,
        });
        throw new ClaudeApiError(
          'Invalid JSON response from Claude API',
          undefined,
          'PARSE_ERROR',
          { response: textContent }
        );
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('Claude API request failed', {
        error: error.message,
        executionTimeMs: executionTime,
        type: error.type,
      });

      if (error instanceof ClaudeApiError) {
        throw error;
      }

      throw new ClaudeApiError(
        error.message || 'Unknown error occurred',
        error.status,
        error.type,
        error
      );
    }
  }

  /**
   * 대화형 채팅 (일반 텍스트 응답)
   * @param messages - 대화 메시지 배열
   * @param systemPrompt - 시스템 프롬프트 (선택)
   * @returns 텍스트 응답
   */
  async chat(messages: ClaudeMessage[], systemPrompt?: string): Promise<string> {
    const startTime = Date.now();

    try {
      logger.info('Calling Claude API for chat', {
        messageCount: messages.length,
        hasSystemPrompt: !!systemPrompt,
      });

      const response = await retry<Anthropic.Message>(
        async () => {
          return await this.client.messages.create({
            model: AI_CONFIG.MODEL,
            max_tokens: AI_CONFIG.MAX_TOKENS,
            temperature: AI_CONFIG.TEMPERATURE,
            system: systemPrompt,
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          });
        },
        {
          maxRetries: 3,
          timeout: AI_CONFIG.TIMEOUT,
          onRetry: (error, attempt) => {
            logger.warn(`Claude API chat request failed, retrying (${attempt}/3)`, {
              error: error.message,
            });
          },
        }
      );

      const executionTime = Date.now() - startTime;

      // 텍스트 콘텐츠 추출
      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n');

      logger.info('Claude API chat response received', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        executionTimeMs: executionTime,
        responseLength: textContent.length,
      });

      return textContent;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('Claude API chat request failed', {
        error: error.message,
        executionTimeMs: executionTime,
        type: error.type,
      });

      throw new ClaudeApiError(
        error.message || 'Unknown error occurred',
        error.status,
        error.type,
        error
      );
    }
  }

  /**
   * JSON 응답 파싱 및 검증
   */
  private parseJsonResponse<T>(response: string): T {
    // JSON 코드 블록 추출 시도 (```json ... ```)
    const jsonBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    const jsonString = jsonBlockMatch ? jsonBlockMatch[1].trim() : response.trim();

    try {
      const parsed = JSON.parse(jsonString);
      return parsed as T;
    } catch (error) {
      // 파싱 실패 시 원본 문자열에서 JSON 객체/배열 찾기 시도
      const objectMatch = jsonString.match(/\{[\s\S]*\}/);
      const arrayMatch = jsonString.match(/\[[\s\S]*\]/);

      if (objectMatch) {
        return JSON.parse(objectMatch[0]) as T;
      }
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]) as T;
      }

      throw error;
    }
  }

  /**
   * 사용량 통계 조회 (디버깅용)
   */
  getUsageStats(): {
    model: string;
    maxTokens: number;
    temperature: number;
  } {
    return {
      model: AI_CONFIG.MODEL,
      maxTokens: AI_CONFIG.MAX_TOKENS,
      temperature: AI_CONFIG.TEMPERATURE,
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
export const claudeClient = new ClaudeClient();
