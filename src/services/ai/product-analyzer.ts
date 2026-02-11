/**
 * @file product-analyzer.ts
 * @description 상품 최적화 AI 서비스
 * @responsibilities
 * - 상품명 최적화 제안
 * - 태그 최적화 제안
 * - A/B 테스트 설계
 */

import { claudeClient } from './claude-client';
import { db } from '@/db/client';
import { logger } from '@/utils/logger';
import { AI_CONFIG } from '@/config/app-config';
import {
  createProductNameOptimizationPrompt,
  createTagOptimizationPrompt,
  createABTestDesignPrompt,
  PRODUCT_OPTIMIZATION_SYSTEM_PROMPT,
} from '@/prompts/product-optimization';
import type {
  ABTestPlan,
  AIDecision,
} from '@/types/ai.types';

/**
 * 상품 분석 서비스
 */
export class ProductAnalyzer {
  /**
   * 상품명 최적화 제안
   */
  async suggestProductNameOptimization(data: {
    product: any;
    stats: {
      views: number;
      clicks: number;
      conversions: number;
      clickRate: number;
      conversionRate: number;
    };
  }): Promise<{
    analysis: {
      currentIssues: string[];
      opportunities: string[];
    };
    suggestions: Array<{
      productName: string;
      reason: string;
      expectedImprovement: string;
    }>;
  }> {
    const startTime = Date.now();

    try {
      logger.info('Starting product name optimization', {
        productId: data.product.id,
      });

      const prompt = createProductNameOptimizationPrompt(data);

      const response = await claudeClient.analyze<{
        analysis: {
          currentIssues: string[];
          opportunities: string[];
        };
        suggestions: Array<{
          productName: string;
          reason: string;
          expectedImprovement: string;
        }>;
      }>(prompt, PRODUCT_OPTIMIZATION_SYSTEM_PROMPT);

      const executionTime = Date.now() - startTime;

      await this.recordDecision({
        decisionType: 'product_optimization',
        inputData: { type: 'product_name', ...data },
        aiResponse: response,
        actions: response.suggestions,
        model: AI_CONFIG.MODEL,
        tokensUsed: 0,
        executionTimeMs: executionTime,
      });

      logger.info('Product name optimization completed', {
        suggestionsCount: response.suggestions.length,
        executionTimeMs: executionTime,
      });

      return response;
    } catch (error) {
      logger.error('Product name optimization failed', { error });
      throw error;
    }
  }

  /**
   * 태그 최적화 제안
   */
  async suggestTagOptimization(data: {
    product: any;
    currentTags: string[];
    relatedTags: string[];
  }): Promise<{
    currentTagsAnalysis: {
      goodTags: string[];
      removeTags: Array<{ tag: string; reason: string }>;
    };
    suggestedTags: Array<{
      tag: string;
      priority: number;
      reason: string;
    }>;
    finalRecommendation: string[];
  }> {
    const startTime = Date.now();

    try {
      logger.info('Starting tag optimization', {
        productId: data.product.id,
        currentTagsCount: data.currentTags.length,
      });

      const prompt = createTagOptimizationPrompt(data);

      const response = await claudeClient.analyze<{
        currentTagsAnalysis: {
          goodTags: string[];
          removeTags: Array<{ tag: string; reason: string }>;
        };
        suggestedTags: Array<{
          tag: string;
          priority: number;
          reason: string;
        }>;
        finalRecommendation: string[];
      }>(prompt, PRODUCT_OPTIMIZATION_SYSTEM_PROMPT);

      const executionTime = Date.now() - startTime;

      await this.recordDecision({
        decisionType: 'product_optimization',
        inputData: { type: 'tags', ...data },
        aiResponse: response,
        actions: response.suggestedTags,
        model: AI_CONFIG.MODEL,
        tokensUsed: 0,
        executionTimeMs: executionTime,
      });

      logger.info('Tag optimization completed', {
        finalRecommendationCount: response.finalRecommendation.length,
        executionTimeMs: executionTime,
      });

      return response;
    } catch (error) {
      logger.error('Tag optimization failed', { error });
      throw error;
    }
  }

  /**
   * A/B 테스트 설계
   */
  async designABTest(data: {
    product: any;
    testType: 'product_name' | 'tags' | 'category';
    currentValue: string | string[];
    stats: {
      views: number;
      clicks: number;
      conversions: number;
      clickRate: number;
      conversionRate: number;
    };
  }): Promise<ABTestPlan> {
    const startTime = Date.now();

    try {
      logger.info('Starting A/B test design', {
        productId: data.product.id,
        testType: data.testType,
      });

      const prompt = createABTestDesignPrompt(data);

      const response = await claudeClient.analyze<ABTestPlan>(
        prompt,
        PRODUCT_OPTIMIZATION_SYSTEM_PROMPT
      );

      const executionTime = Date.now() - startTime;

      await this.recordDecision({
        decisionType: 'product_optimization',
        inputData: { type: 'ab_test', ...data },
        aiResponse: response,
        actions: [response],
        model: AI_CONFIG.MODEL,
        tokensUsed: 0,
        executionTimeMs: executionTime,
      });

      logger.info('A/B test design completed', {
        testType: response.testType,
        duration: response.expectedDuration,
        executionTimeMs: executionTime,
      });

      return response;
    } catch (error) {
      logger.error('A/B test design failed', { error });
      throw error;
    }
  }

  /**
   * AI 의사결정 DB 기록
   */
  private async recordDecision(decision: AIDecision): Promise<number> {
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

      return result.rows[0]!.id;
    } catch (error) {
      logger.error('Failed to record AI decision', { error });
      throw error;
    }
  }
}

/**
 * 싱글톤 인스턴스
 */
export const productAnalyzer = new ProductAnalyzer();
