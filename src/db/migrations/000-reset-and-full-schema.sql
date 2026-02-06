-- =============================================
-- Supabase 전체 초기화 + 스키마 생성
-- 기존 데이터를 모두 삭제하고 새로 생성합니다.
-- Supabase SQL Editor에서 실행하세요.
-- =============================================

-- ============================================
-- STEP 1: 기존 테이블 삭제 (CASCADE가 트리거도 자동 삭제)
-- ============================================
DROP TABLE IF EXISTS redundant_keywords_dict CASCADE;
DROP TABLE IF EXISTS ranking_error_logs CASCADE;
DROP TABLE IF EXISTS keyword_ranking_alerts CASCADE;
DROP TABLE IF EXISTS keyword_ranking_daily CASCADE;
DROP TABLE IF EXISTS keyword_analysis_snapshots CASCADE;
DROP TABLE IF EXISTS keyword_analysis_logs CASCADE;
DROP TABLE IF EXISTS keyword_product_mapping CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS protected_items CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS ai_decision_results CASCADE;
DROP TABLE IF EXISTS ai_decisions CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_ab_tests CASCADE;
DROP TABLE IF EXISTS product_daily_stats CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS tested_keywords_history CASCADE;
DROP TABLE IF EXISTS ad_keyword_tests CASCADE;
DROP TABLE IF EXISTS ad_keyword_daily_stats CASCADE;
DROP TABLE IF EXISTS ad_keywords CASCADE;

-- ============================================
-- STEP 2: 트리거 함수 삭제
-- ============================================
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================
-- STEP 4: 테이블 생성 (schema.sql)
-- ============================================

-- 1. 광고 키워드 관련 테이블

CREATE TABLE ad_keywords (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    naver_keyword_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    bid_amount INTEGER NOT NULL,
    is_test BOOLEAN DEFAULT TRUE,
    test_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    test_ended_at TIMESTAMP WITH TIME ZONE,
    is_protected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, keyword)
);

CREATE INDEX idx_ad_keywords_product_id ON ad_keywords(product_id);
CREATE INDEX idx_ad_keywords_status ON ad_keywords(status);
CREATE INDEX idx_ad_keywords_is_test ON ad_keywords(is_test);

CREATE TABLE ad_keyword_daily_stats (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES ad_keywords(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cost INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    click_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    roas DECIMAL(8,2),
    avg_click_cost INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(keyword_id, date)
);

CREATE INDEX idx_ad_keyword_daily_stats_keyword_id ON ad_keyword_daily_stats(keyword_id);
CREATE INDEX idx_ad_keyword_daily_stats_date ON ad_keyword_daily_stats(date);

CREATE TABLE ad_keyword_tests (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES ad_keywords(id) ON DELETE CASCADE,
    test_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    test_ended_at TIMESTAMP WITH TIME ZONE,
    test_result VARCHAR(20),
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_cost INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    final_roas DECIMAL(8,2),
    removal_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ad_keyword_tests_keyword_id ON ad_keyword_tests(keyword_id);

CREATE TABLE tested_keywords_history (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    last_tested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    test_count INTEGER DEFAULT 1,
    UNIQUE(product_id, keyword)
);

CREATE INDEX idx_tested_keywords_history_product_id ON tested_keywords_history(product_id);

-- 2. 상품 관련 테이블

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    naver_product_id VARCHAR(100) NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    category_id VARCHAR(100),
    category_name VARCHAR(255),
    tags TEXT[],
    attributes JSONB,
    excluded_from_test BOOLEAN DEFAULT FALSE,
    -- 002 마이그레이션 확장 컬럼 포함
    store_name VARCHAR(255),
    naver_shopping_product_id VARCHAR(100),
    current_popularity_stage VARCHAR(20) DEFAULT 'extreme_early',
    representative_keyword VARCHAR(255),
    representative_keyword_rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_naver_product_id ON products(naver_product_id);
CREATE INDEX idx_products_excluded_from_test ON products(excluded_from_test);

CREATE TABLE product_daily_stats (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    click_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, date)
);

CREATE INDEX idx_product_daily_stats_product_id ON product_daily_stats(product_id);
CREATE INDEX idx_product_daily_stats_date ON product_daily_stats(date);

CREATE TABLE product_ab_tests (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    test_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    variant_a_id INTEGER,
    variant_b_id INTEGER,
    test_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    test_ended_at TIMESTAMP WITH TIME ZONE,
    winner VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_ab_tests_product_id ON product_ab_tests(product_id);
CREATE INDEX idx_product_ab_tests_status ON product_ab_tests(status);

CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES product_ab_tests(id) ON DELETE CASCADE,
    variant_type VARCHAR(10) NOT NULL,
    product_name TEXT,
    tags TEXT[],
    category_id VARCHAR(100),
    attributes JSONB,
    total_views INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    click_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_variants_test_id ON product_variants(test_id);

-- 3. AI 관련 테이블

CREATE TABLE ai_decisions (
    id SERIAL PRIMARY KEY,
    decision_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    ai_response JSONB NOT NULL,
    actions JSONB NOT NULL,
    model VARCHAR(100),
    tokens_used INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_decisions_decision_type ON ai_decisions(decision_type);
CREATE INDEX idx_ai_decisions_created_at ON ai_decisions(created_at);

CREATE TABLE ai_decision_results (
    id SERIAL PRIMARY KEY,
    decision_id INTEGER NOT NULL REFERENCES ai_decisions(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL,
    result_data JSONB,
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_decision_results_decision_id ON ai_decision_results(decision_id);
CREATE INDEX idx_ai_decision_results_status ON ai_decision_results(status);

-- 4. 설정 테이블

CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE protected_items (
    id SERIAL PRIMARY KEY,
    item_type VARCHAR(50) NOT NULL,
    item_id INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_type, item_id)
);

CREATE INDEX idx_protected_items_item_type ON protected_items(item_type);

-- ============================================
-- STEP 5: 테이블 생성 (002-keyword-analysis-tables.sql)
-- ============================================

-- 키워드 마스터 테이블

CREATE TABLE keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL UNIQUE,
    keyword_type VARCHAR(20),
    keyword_type_confidence DECIMAL(3,2),
    synonym_group_id INTEGER,
    color_class VARCHAR(20),
    title_match_ratio DECIMAL(5,2),
    category_match_ratio DECIMAL(5,2),
    monthly_pc_search INTEGER DEFAULT 0,
    monthly_mobile_search INTEGER DEFAULT 0,
    monthly_total_search INTEGER DEFAULT 0,
    competition_index VARCHAR(10),
    registered_count_joined INTEGER,
    registered_count_spaced INTEGER,
    registered_count_reversed INTEGER,
    last_type_classified_at TIMESTAMP WITH TIME ZONE,
    last_color_classified_at TIMESTAMP WITH TIME ZONE,
    last_search_volume_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keywords_keyword ON keywords(keyword);
CREATE INDEX idx_keywords_keyword_type ON keywords(keyword_type);
CREATE INDEX idx_keywords_color_class ON keywords(color_class);
CREATE INDEX idx_keywords_synonym_group ON keywords(synonym_group_id);
CREATE INDEX idx_keywords_monthly_total_search ON keywords(monthly_total_search DESC);

-- 키워드-상품 매핑

CREATE TABLE keyword_product_mapping (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    placement VARCHAR(20) NOT NULL,
    is_tracked BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(keyword_id, product_id)
);

CREATE INDEX idx_keyword_product_mapping_keyword_id ON keyword_product_mapping(keyword_id);
CREATE INDEX idx_keyword_product_mapping_product_id ON keyword_product_mapping(product_id);
CREATE INDEX idx_keyword_product_mapping_is_tracked ON keyword_product_mapping(is_tracked);

-- 색깔 분류 분석 로그

CREATE TABLE keyword_analysis_logs (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    analysis_type VARCHAR(30) NOT NULL,
    prev_color_class VARCHAR(20),
    new_color_class VARCHAR(20),
    prev_keyword_type VARCHAR(20),
    new_keyword_type VARCHAR(20),
    title_match_count INTEGER,
    category_match_count INTEGER,
    total_products_analyzed INTEGER,
    title_match_ratio DECIMAL(5,2),
    category_match_ratio DECIMAL(5,2),
    api_calls_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keyword_analysis_logs_keyword_id ON keyword_analysis_logs(keyword_id);
CREATE INDEX idx_keyword_analysis_logs_created_at ON keyword_analysis_logs(created_at);

-- 분석 스냅샷

CREATE TABLE keyword_analysis_snapshots (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    analysis_log_id INTEGER REFERENCES keyword_analysis_logs(id) ON DELETE SET NULL,
    search_results JSONB NOT NULL,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keyword_analysis_snapshots_keyword_id ON keyword_analysis_snapshots(keyword_id);
CREATE INDEX idx_keyword_analysis_snapshots_snapshot_date ON keyword_analysis_snapshots(snapshot_date);

-- 키워드 순위 일일 기록

CREATE TABLE keyword_ranking_daily (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    rank INTEGER,
    rank_limit INTEGER NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keyword_ranking_daily_product_keyword ON keyword_ranking_daily(product_id, keyword);
CREATE INDEX idx_keyword_ranking_daily_checked_at ON keyword_ranking_daily(checked_at);
CREATE INDEX idx_keyword_ranking_daily_keyword_date ON keyword_ranking_daily(keyword, checked_at);

-- 순위 변동 알림

CREATE TABLE keyword_ranking_alerts (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    prev_rank INTEGER,
    curr_rank INTEGER,
    change_amount INTEGER,
    alert_type VARCHAR(20) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keyword_ranking_alerts_product_id ON keyword_ranking_alerts(product_id);
CREATE INDEX idx_keyword_ranking_alerts_alert_type ON keyword_ranking_alerts(alert_type);
CREATE INDEX idx_keyword_ranking_alerts_is_read ON keyword_ranking_alerts(is_read);

-- 순위 추적 에러 로그

CREATE TABLE ranking_error_logs (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255),
    product_id VARCHAR(100),
    error_code VARCHAR(20),
    error_msg TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ranking_error_logs_created_at ON ranking_error_logs(created_at);

-- 불필요 키워드 사전

CREATE TABLE redundant_keywords_dict (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    verified BOOLEAN DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STEP 6: 트리거 함수 + 트리거 생성
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE TRIGGER update_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keyword_product_mapping_updated_at
    BEFORE UPDATE ON keyword_product_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 7: 기본 설정값 삽입
-- ============================================

INSERT INTO settings (key, value, description) VALUES
('max_keywords_per_product', '5', '상품당 최대 키워드 개수'),
('test_protection_days', '14', '신규 키워드 테스트 보호 기간 (일)'),
('min_roas_threshold', '100', 'ROAS 최소 기준 (%)'),
('ab_test_duration_days', '14', 'A/B 테스트 기간 (일)'),
('auto_run_enabled', 'true', '자동 실행 활성화 여부'),
('rank_check_limit', '1000', '순위 추적 최대 범위'),
('rank_change_alert_threshold', '50', '순위 변동 알림 기준'),
('shopping_api_daily_budget', '25000', '쇼핑 검색 API 일일 호출 한도'),
('ranking_api_budget', '15000', '순위 추적 API 예산'),
('color_analysis_api_budget', '5000', '색깔 분류 API 예산'),
('reserve_api_budget', '5000', '예비 API 예산'),
('popularity_surge_threshold', '50', '인기도 급변 감지 임계값'),
('auto_rebalance_mode', '"manual"', '자동 재배치 모드: auto / manual');

-- ============================================
-- STEP 8: 불필요 키워드 사전 초기 데이터
-- ============================================

INSERT INTO redundant_keywords_dict (keyword, verified, note) VALUES
('예쁜', true, '네이버가 무시하는 형용사'),
('추천', true, '"신발 추천" = "신발"'),
('저렴한', true, '가격 수식어'),
('가격', true, '불필요 수식어'),
('판매', true, '불필요 수식어'),
('인기', true, '불필요 수식어'),
('최저가', false, '검증 필요'),
('할인', false, '검증 필요'),
('베스트', false, '검증 필요'),
('핫딜', false, '검증 필요');

-- ============================================
-- 완료! 모든 테이블이 생성되었습니다.
-- ============================================
