/**
 * @file ai.types.ts
 * @description AI 관련 타입 정의
 * @responsibilities
 * - 키워드 액션 타입
 * - 상품 최적화 타입
 * - AI 의사결정 타입
 */

// ============================================
// 키워드 관련 타입
// ============================================

export interface KeywordAction {
  type: 'add' | 'remove' | 'update' | 'keep';
  keywordId?: string;
  keyword?: string;
  bidAmount?: number;
  reason: string;
}

export interface KeywordWithStats {
  id: string;
  keyword: string;
  productId: string;
  bidAmount: number;
  isTest: boolean;
  daysSinceCreated: number;

  // 성과 데이터
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  sales: number;
  roas: number;
  clickRate: number;
  conversionRate: number;
  avgClickCost: number;
}

export interface KeywordEvaluationResult {
  actions: KeywordAction[];
  summary: {
    totalKeywords: number;
    toRemove: number;
    toUpdate: number;
    toKeep: number;
  };
}

// ============================================
// 상품 관련 타입
// ============================================

export interface ProductOptimizationSuggestion {
  type: 'product_name' | 'tags' | 'category';
  currentValue: string | string[];
  suggestedValue: string | string[];
  reason: string;
  expectedImprovement: string;
}

export interface ABTestPlan {
  testType: 'product_name' | 'tags' | 'category';
  variantA: {
    value: string | string[];
    description: string;
  };
  variantB: {
    value: string | string[];
    description: string;
  };
  hypothesis: string;
  expectedDuration: number; // 일
}

// ============================================
// AI 의사결정 타입
// ============================================

export type AIDecisionType =
  | 'keyword_evaluation'
  | 'keyword_discovery'
  | 'product_optimization';

export interface AIDecision {
  id?: number;
  decisionType: AIDecisionType;
  inputData: any;
  aiResponse: any;
  actions: any[];
  model: string;
  tokensUsed: number;
  executionTimeMs: number;
  createdAt?: Date;
}

export interface AIDecisionResult {
  id?: number;
  decisionId: number;
  actionType: string;
  actionData: any;
  status: 'pending' | 'success' | 'failed';
  resultData?: any;
  errorMessage?: string;
  executedAt?: Date;
}

// ============================================
// Claude API 응답 타입
// ============================================

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
