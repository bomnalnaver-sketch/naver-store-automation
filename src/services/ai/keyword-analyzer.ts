/**
 * @file keyword-analyzer.ts
 * @description 키워드 분석 AI 서비스
 * @responsibilities
 * - 키워드 성과 평가 및 액션 제안
 * - 신규 키워드 발굴
 * - AI 의사결정 기록
 */

import { claudeClient } from './claude-client';
import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { AD_KEYWORD_CONFIG, AI_CONFIG } from '@/config/app-config';
import {
  createKeywordEvaluationPrompt,
  createKeywordDiscoveryPrompt,
  KEYWORD_EVALUATION_SYSTEM_PROMPT,
  KEYWORD_DISCOVERY_SYSTEM_PROMPT,
} from '@/prompts/keyword-analysis';
import type {
  KeywordWithStats,
  KeywordEvaluationResult,
  AIDecision,
} from '@/types/ai.types';
import type { SearchAdRelatedKeyword } from '@/types/naver-api.types';

/**
 * 키워드 분석 서비스
 */
export class KeywordAnalyzer {
  /**
   * 키워드 성과 평가 및 액션 제안
   */
  async evaluateKeywords(keywords: KeywordWithStats[]): Promise<KeywordEvaluationResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting keyword evaluation', {
        keywordCount: keywords.length,
      });

      // 프롬프트 생성
      const prompt = createKeywordEvaluationPrompt({
        keywords,
        config: {
          maxKeywordsPerProduct: AD_KEYWORD_CONFIG.MAX_KEYWORDS_PER_PRODUCT,
          minRoasThreshold: AD_KEYWORD_CONFIG.MIN_ROAS_THRESHOLD,
          testProtectionDays: AD_KEYWORD_CONFIG.TEST_PROTECTION_DAYS,
        },
      });

      // Claude API 호출
      const response = await claudeClient.analyze<KeywordEvaluationResult>(
        prompt,
        KEYWORD_EVALUATION_SYSTEM_PROMPT
      );

      const executionTime = Date.now() - startTime;

      // 의사결정 기록
      await this.recordDecision({
        decisionType: 'keyword_evaluation',
        inputData: { keywords, config: AD_KEYWORD_CONFIG },
        aiResponse: response,
        actions: response.actions,
        model: AI_CONFIG.MODEL,
        tokensUsed: 0, // Claude client에서 로깅됨
        executionTimeMs: executionTime,
      });

      logger.info('Keyword evaluation completed', {
        totalKeywords: response.summary.totalKeywords,
        toRemove: response.summary.toRemove,
        toUpdate: response.summary.toUpdate,
        toKeep: response.summary.toKeep,
        executionTimeMs: executionTime,
      });

      return response;
    } catch (error) {
      logger.error('Keyword evaluation failed', { error });
      throw error;
    }
  }

  /**
   * 신규 키워드 발굴
   */
  async discoverKeywords(data: {
    product: any;
    relatedKeywords: SearchAdRelatedKeyword[];
    testedKeywords: string[];
    currentKeywords: string[];
  }): Promise<Array<{ keyword: string; reason: string; estimatedBidAmount: number }>> {
    const startTime = Date.now();

    try {
      logger.info('Starting keyword discovery', {
        productId: data.product.id,
        relatedKeywordsCount: data.relatedKeywords.length,
      });

      // 프롬프트 생성
      const prompt = createKeywordDiscoveryPrompt(data);

      // Claude API 호출
      const response = await claudeClient.analyze<{
        keywords: Array<{
          keyword: string;
          reason: string;
          estimatedBidAmount: number;
        }>;
      }>(prompt, KEYWORD_DISCOVERY_SYSTEM_PROMPT);

      const executionTime = Date.now() - startTime;

      // 의사결정 기록
      await this.recordDecision({
        decisionType: 'keyword_discovery',
        inputData: data,
        aiResponse: response,
        actions: response.keywords,
        model: AI_CONFIG.MODEL,
        tokensUsed: 0,
        executionTimeMs: executionTime,
      });

      logger.info('Keyword discovery completed', {
        discoveredCount: response.keywords.length,
        executionTimeMs: executionTime,
      });

      return response.keywords;
    } catch (error) {
      logger.error('Keyword discovery failed', { error });
      throw error;
    }
  }

  /**
   * AI 의사결정 DB 기록
   */
  async recordDecision(decision: AIDecision): Promise<number> {
    try {
      const result = await db.query<{ id: number }>(
        `INSERT INTO ai_decisions (
          decision_type, input_data, ai_response, actions,
          model, tokens_used, execution_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          decision.decisionType,
          JSON.stringify(decision.inputData),
          JSON.stringify(decision.aiResponse),
          JSON.stringify(decision.actions),
          decision.model,
          decision.tokensUsed,
          decision.executionTimeMs,
        ]
      );

      const decisionId = result.rows[0]!.id;

      logger.info('AI decision recorded', {
        decisionId,
        decisionType: decision.decisionType,
      });

      return decisionId;
    } catch (error) {
      logger.error('Failed to record AI decision', { error });
      throw error;
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
export const keywordAnalyzer = new KeywordAnalyzer();
