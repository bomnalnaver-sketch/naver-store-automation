-- 키워드 분석 & 순위 추적 시스템 테이블
-- 관련 문서: docs/keyword-analysis-logic.md, docs/system-design-v2.md, docs/keyword-ranking-tracker.md

-- ============================================
-- 1. 키워드 마스터 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL UNIQUE,

    -- 키워드 유형 분류 (5-type: composite, integral, order_fixed, synonym, redundant)
    keyword_type VARCHAR(20),
    keyword_type_confidence DECIMAL(3,2),
    synonym_group_id INTEGER,

    -- 색깔 분류 (yellow, gray, green, blue, orange)
    color_class VARCHAR(20),
    title_match_ratio DECIMAL(5,2),
    category_match_ratio DECIMAL(5,2),

    -- 검색량 데이터
    monthly_pc_search INTEGER DEFAULT 0,
    monthly_mobile_search INTEGER DEFAULT 0,
    monthly_total_search INTEGER DEFAULT 0,
    competition_index VARCHAR(10),

    -- 등록상품수 (유형 판별용)
    registered_count_joined INTEGER,
    registered_count_spaced INTEGER,
    registered_count_reversed INTEGER,

    -- 분류 시점
    last_type_classified_at TIMESTAMP WITH TIME ZONE,
    last_color_classified_at TIMESTAMP WITH TIME ZONE,
    last_search_volume_updated_at TIMESTAMP WITH TIME ZONE,

    -- 메타
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keywords_keyword ON keywords(keyword);
CREATE INDEX idx_keywords_keyword_type ON keywords(keyword_type);
CREATE INDEX idx_keywords_color_class ON keywords(color_class);
CREATE INDEX idx_keywords_synonym_group ON keywords(synonym_group_id);
CREATE INDEX idx_keywords_monthly_total_search ON keywords(monthly_total_search DESC);

-- ============================================
-- 2. 키워드-상품 매핑 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_product_mapping (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    placement VARCHAR(20) NOT NULL,  -- product_name, tag, attribute, none
    is_tracked BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(keyword_id, product_id)
);

CREATE INDEX idx_keyword_product_mapping_keyword_id ON keyword_product_mapping(keyword_id);
CREATE INDEX idx_keyword_product_mapping_product_id ON keyword_product_mapping(product_id);
CREATE INDEX idx_keyword_product_mapping_is_tracked ON keyword_product_mapping(is_tracked);

-- ============================================
-- 3. 색깔 분류 분석 로그
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_analysis_logs (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,

    analysis_type VARCHAR(30) NOT NULL,  -- color_classification, type_classification, full
    prev_color_class VARCHAR(20),
    new_color_class VARCHAR(20),
    prev_keyword_type VARCHAR(20),
    new_keyword_type VARCHAR(20),

    -- 분석 데이터
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

-- ============================================
-- 4. 분석 스냅샷 (상위 40개 상품 저장)
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_analysis_snapshots (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    analysis_log_id INTEGER REFERENCES keyword_analysis_logs(id) ON DELETE SET NULL,

    search_results JSONB NOT NULL,
    snapshot_date DATE NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keyword_analysis_snapshots_keyword_id ON keyword_analysis_snapshots(keyword_id);
CREATE INDEX idx_keyword_analysis_snapshots_snapshot_date ON keyword_analysis_snapshots(snapshot_date);

-- ============================================
-- 5. 키워드 순위 일일 기록
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_ranking_daily (
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

-- ============================================
-- 6. 순위 변동 알림
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_ranking_alerts (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    prev_rank INTEGER,
    curr_rank INTEGER,
    change_amount INTEGER,
    alert_type VARCHAR(20) NOT NULL,  -- SURGE, DROP, ENTER, EXIT
    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keyword_ranking_alerts_product_id ON keyword_ranking_alerts(product_id);
CREATE INDEX idx_keyword_ranking_alerts_alert_type ON keyword_ranking_alerts(alert_type);
CREATE INDEX idx_keyword_ranking_alerts_is_read ON keyword_ranking_alerts(is_read);

-- ============================================
-- 7. 순위 추적 에러 로그
-- ============================================

CREATE TABLE IF NOT EXISTS ranking_error_logs (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255),
    product_id VARCHAR(100),
    error_code VARCHAR(20),
    error_msg TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ranking_error_logs_created_at ON ranking_error_logs(created_at);

-- ============================================
-- 8. 불필요 키워드 사전
-- ============================================

CREATE TABLE IF NOT EXISTS redundant_keywords_dict (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL UNIQUE,
    verified BOOLEAN DEFAULT FALSE,
    note TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 초기 데이터
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
('핫딜', false, '검증 필요')
ON CONFLICT (keyword) DO NOTHING;

-- ============================================
-- 9. products 테이블 확장
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS naver_shopping_product_id VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_popularity_stage VARCHAR(20) DEFAULT 'extreme_early';
ALTER TABLE products ADD COLUMN IF NOT EXISTS representative_keyword VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS representative_keyword_rank INTEGER;

-- ============================================
-- 10. 트리거
-- ============================================

CREATE TRIGGER update_keywords_updated_at
    BEFORE UPDATE ON keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keyword_product_mapping_updated_at
    BEFORE UPDATE ON keyword_product_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. 추가 설정값
-- ============================================

INSERT INTO settings (key, value, description) VALUES
('rank_check_limit', '1000', '순위 추적 최대 범위'),
('rank_change_alert_threshold', '50', '순위 변동 알림 기준'),
('shopping_api_daily_budget', '25000', '쇼핑 검색 API 일일 호출 한도'),
('ranking_api_budget', '15000', '순위 추적 API 예산'),
('color_analysis_api_budget', '5000', '색깔 분류 API 예산'),
('reserve_api_budget', '5000', '예비 API 예산'),
('popularity_surge_threshold', '50', '인기도 급변 감지 임계값'),
('auto_rebalance_mode', '"manual"', '자동 재배치 모드: auto / manual')
ON CONFLICT (key) DO NOTHING;
