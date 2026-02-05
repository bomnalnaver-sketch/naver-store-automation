-- 네이버 스마트스토어 AI 자동화 시스템 DB 스키마
-- PostgreSQL 14+

-- ============================================
-- 1. 광고 키워드 관련 테이블
-- ============================================

-- 광고 키워드 마스터 테이블
CREATE TABLE IF NOT EXISTS ad_keywords (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL, -- 네이버 상품 ID
    keyword VARCHAR(255) NOT NULL, -- 키워드
    naver_keyword_id VARCHAR(100), -- 네이버 API 키워드 ID
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, removed
    bid_amount INTEGER NOT NULL, -- 입찰가 (원)

    -- 테스트 관련
    is_test BOOLEAN DEFAULT TRUE, -- 테스트 중 여부
    test_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    test_ended_at TIMESTAMP WITH TIME ZONE,

    -- 보호 설정
    is_protected BOOLEAN DEFAULT FALSE, -- AI가 건드리지 않음

    -- 메타 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(product_id, keyword)
);

CREATE INDEX idx_ad_keywords_product_id ON ad_keywords(product_id);
CREATE INDEX idx_ad_keywords_status ON ad_keywords(status);
CREATE INDEX idx_ad_keywords_is_test ON ad_keywords(is_test);

-- 광고 키워드 일별 성과 테이블
CREATE TABLE IF NOT EXISTS ad_keyword_daily_stats (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES ad_keywords(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- 성과 지표
    impressions INTEGER DEFAULT 0, -- 노출수
    clicks INTEGER DEFAULT 0, -- 클릭수
    cost INTEGER DEFAULT 0, -- 광고비 (원)
    conversions INTEGER DEFAULT 0, -- 전환수
    sales INTEGER DEFAULT 0, -- 매출 (원)

    -- 계산된 지표
    click_rate DECIMAL(5,2), -- 클릭률 (%)
    conversion_rate DECIMAL(5,2), -- 전환율 (%)
    roas DECIMAL(8,2), -- ROAS (%)
    avg_click_cost INTEGER, -- 평균 클릭 비용 (원)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(keyword_id, date)
);

CREATE INDEX idx_ad_keyword_daily_stats_keyword_id ON ad_keyword_daily_stats(keyword_id);
CREATE INDEX idx_ad_keyword_daily_stats_date ON ad_keyword_daily_stats(date);

-- 광고 키워드 테스트 기록
CREATE TABLE IF NOT EXISTS ad_keyword_tests (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES ad_keywords(id) ON DELETE CASCADE,

    -- 테스트 정보
    test_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    test_ended_at TIMESTAMP WITH TIME ZONE,
    test_result VARCHAR(20), -- pass, fail, protected, manual_stop

    -- 최종 성과
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_cost INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    final_roas DECIMAL(8,2),

    -- 탈락 사유
    removal_reason TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ad_keyword_tests_keyword_id ON ad_keyword_tests(keyword_id);

-- 테스트 완료 키워드 히스토리 (재테스트 방지)
CREATE TABLE IF NOT EXISTS tested_keywords_history (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    last_tested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    test_count INTEGER DEFAULT 1,

    UNIQUE(product_id, keyword)
);

CREATE INDEX idx_tested_keywords_history_product_id ON tested_keywords_history(product_id);

-- ============================================
-- 2. 상품 관련 테이블
-- ============================================

-- 상품 마스터 테이블
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    naver_product_id VARCHAR(100) NOT NULL UNIQUE, -- 네이버 상품 ID

    -- 현재 상품 정보
    product_name TEXT NOT NULL,
    category_id VARCHAR(100),
    category_name VARCHAR(255),
    tags TEXT[], -- 태그 배열
    attributes JSONB, -- 상품 속성 (JSON)

    -- 테스트 제외 설정
    excluded_from_test BOOLEAN DEFAULT FALSE,

    -- 메타 정보
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_naver_product_id ON products(naver_product_id);
CREATE INDEX idx_products_excluded_from_test ON products(excluded_from_test);

-- 상품 일별 성과 테이블
CREATE TABLE IF NOT EXISTS product_daily_stats (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- 성과 지표
    views INTEGER DEFAULT 0, -- 조회수
    clicks INTEGER DEFAULT 0, -- 클릭수
    orders INTEGER DEFAULT 0, -- 주문수
    sales INTEGER DEFAULT 0, -- 매출 (원)

    -- 계산된 지표
    click_rate DECIMAL(5,2), -- 클릭률 (%)
    conversion_rate DECIMAL(5,2), -- 전환율 (%)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(product_id, date)
);

CREATE INDEX idx_product_daily_stats_product_id ON product_daily_stats(product_id);
CREATE INDEX idx_product_daily_stats_date ON product_daily_stats(date);

-- 상품 A/B 테스트 테이블
CREATE TABLE IF NOT EXISTS product_ab_tests (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- 테스트 정보
    test_type VARCHAR(50) NOT NULL, -- product_name, tags, category, attributes
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, completed, stopped

    -- A/B 변형 ID
    variant_a_id INTEGER, -- A안 (현재)
    variant_b_id INTEGER, -- B안 (변경)

    -- 테스트 기간
    test_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    test_ended_at TIMESTAMP WITH TIME ZONE,

    -- 승자
    winner VARCHAR(10), -- a, b, tie

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_ab_tests_product_id ON product_ab_tests(product_id);
CREATE INDEX idx_product_ab_tests_status ON product_ab_tests(status);

-- A/B 테스트 변형 (A안/B안)
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES product_ab_tests(id) ON DELETE CASCADE,
    variant_type VARCHAR(10) NOT NULL, -- a, b

    -- 변형 내용
    product_name TEXT,
    tags TEXT[],
    category_id VARCHAR(100),
    attributes JSONB,

    -- 성과
    total_views INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,

    -- 계산된 지표
    click_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_variants_test_id ON product_variants(test_id);

-- ============================================
-- 3. AI 관련 테이블
-- ============================================

-- AI 의사결정 기록
CREATE TABLE IF NOT EXISTS ai_decisions (
    id SERIAL PRIMARY KEY,

    -- 결정 타입
    decision_type VARCHAR(50) NOT NULL, -- keyword_evaluation, keyword_discovery, product_optimization

    -- 입력 데이터
    input_data JSONB NOT NULL,

    -- AI 응답
    ai_response JSONB NOT NULL,

    -- 액션 리스트
    actions JSONB NOT NULL, -- AI가 제안한 액션들

    -- 메타 정보
    model VARCHAR(100), -- 사용한 AI 모델
    tokens_used INTEGER, -- 사용한 토큰 수
    execution_time_ms INTEGER, -- 실행 시간 (ms)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_decisions_decision_type ON ai_decisions(decision_type);
CREATE INDEX idx_ai_decisions_created_at ON ai_decisions(created_at);

-- AI 결정 결과 추적
CREATE TABLE IF NOT EXISTS ai_decision_results (
    id SERIAL PRIMARY KEY,
    decision_id INTEGER NOT NULL REFERENCES ai_decisions(id) ON DELETE CASCADE,

    -- 액션 정보
    action_type VARCHAR(50) NOT NULL, -- add_keyword, remove_keyword, update_product, etc.
    action_data JSONB NOT NULL,

    -- 실행 결과
    status VARCHAR(20) NOT NULL, -- pending, success, failed
    result_data JSONB,
    error_message TEXT,

    -- 실행 시간
    executed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_decision_results_decision_id ON ai_decision_results(decision_id);
CREATE INDEX idx_ai_decision_results_status ON ai_decision_results(status);

-- ============================================
-- 4. 설정 테이블
-- ============================================

-- 사용자 설정
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 기본 설정값 삽입
INSERT INTO settings (key, value, description) VALUES
('max_keywords_per_product', '5', '상품당 최대 키워드 개수'),
('test_protection_days', '14', '신규 키워드 테스트 보호 기간 (일)'),
('min_roas_threshold', '100', 'ROAS 최소 기준 (%)'),
('ab_test_duration_days', '14', 'A/B 테스트 기간 (일)'),
('auto_run_enabled', 'true', '자동 실행 활성화 여부')
ON CONFLICT (key) DO NOTHING;

-- 보호 목록 (AI가 건드리지 않음)
CREATE TABLE IF NOT EXISTS protected_items (
    id SERIAL PRIMARY KEY,
    item_type VARCHAR(50) NOT NULL, -- keyword, product
    item_id INTEGER NOT NULL, -- ad_keywords.id 또는 products.id
    reason TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(item_type, item_id)
);

CREATE INDEX idx_protected_items_item_type ON protected_items(item_type);

-- ============================================
-- 5. 트리거 함수
-- ============================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
CREATE TRIGGER update_ad_keywords_updated_at
    BEFORE UPDATE ON ad_keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_ab_tests_updated_at
    BEFORE UPDATE ON product_ab_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
