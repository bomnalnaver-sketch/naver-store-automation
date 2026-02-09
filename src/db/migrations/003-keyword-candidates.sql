-- 키워드 발굴/선정/라이프사이클 시스템 테이블
-- 관련 문서: docs/keyword-strategy.md

-- ============================================
-- 1. 키워드 후보 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_candidates (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    keyword_id INTEGER REFERENCES keywords(id) ON DELETE SET NULL,
    keyword VARCHAR(255) NOT NULL,

    -- 발굴 정보
    source VARCHAR(30) NOT NULL,  -- product_name, search_ad, competitor
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 상태 관리
    -- pending_approval: 수동 승인 대기 (관련성 낮음)
    -- candidate: 발굴됨, 테스트 대기
    -- testing: 테스트 중 (상품에 적용됨)
    -- active: 테스트 통과, 활성 상태
    -- warning: 성과 하락 경고
    -- failed: 테스트 실패
    -- rejected: 사용자 거부
    -- retired: 퇴역 (더 이상 사용 안함)
    status VARCHAR(20) NOT NULL DEFAULT 'candidate',

    -- 승인 관련
    approval_status VARCHAR(20) DEFAULT 'approved',  -- pending, approved, rejected
    approval_reason TEXT,
    approval_at TIMESTAMP WITH TIME ZONE,
    filter_reason TEXT,  -- 필터링된 이유 (관련성 낮음 등)
    category_match_ratio DECIMAL(5,2),  -- 카테고리 일치율

    -- 경쟁강도/검색량 (발굴 시점 기록)
    competition_index VARCHAR(10),  -- LOW, MEDIUM, HIGH
    monthly_search_volume INTEGER DEFAULT 0,

    -- 테스트 관련
    test_started_at TIMESTAMP WITH TIME ZONE,
    test_ended_at TIMESTAMP WITH TIME ZONE,
    test_result VARCHAR(20),  -- pass, fail, timeout

    -- 성과 지표
    best_rank INTEGER,  -- 최고 순위
    current_rank INTEGER,  -- 현재 순위
    days_in_top40 INTEGER DEFAULT 0,  -- 1페이지 진입 일수
    consecutive_days_in_top40 INTEGER DEFAULT 0,  -- 연속 1페이지 일수
    contribution_score DECIMAL(5,2) DEFAULT 0,  -- 인기도 기여 점수

    -- 후보 점수 (선정 시 사용)
    candidate_score DECIMAL(5,2) DEFAULT 0,

    -- 메타
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(product_id, keyword)
);

CREATE INDEX idx_keyword_candidates_product_id ON keyword_candidates(product_id);
CREATE INDEX idx_keyword_candidates_keyword_id ON keyword_candidates(keyword_id);
CREATE INDEX idx_keyword_candidates_status ON keyword_candidates(status);
CREATE INDEX idx_keyword_candidates_source ON keyword_candidates(source);
CREATE INDEX idx_keyword_candidates_competition_index ON keyword_candidates(competition_index);
CREATE INDEX idx_keyword_candidates_candidate_score ON keyword_candidates(candidate_score DESC);
CREATE INDEX idx_keyword_candidates_approval_status ON keyword_candidates(approval_status);

-- ============================================
-- 2. 키워드 라이프사이클 로그
-- ============================================

CREATE TABLE IF NOT EXISTS keyword_lifecycle_logs (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES keyword_candidates(id) ON DELETE CASCADE,

    -- 상태 변경
    prev_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,

    -- 변경 사유
    reason TEXT,

    -- 변경 시점 지표
    metrics JSONB,
    -- 예: { "rank": 35, "days_in_top40": 5, "contribution_score": 12.5 }

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keyword_lifecycle_logs_candidate_id ON keyword_lifecycle_logs(candidate_id);
CREATE INDEX idx_keyword_lifecycle_logs_new_status ON keyword_lifecycle_logs(new_status);
CREATE INDEX idx_keyword_lifecycle_logs_created_at ON keyword_lifecycle_logs(created_at);

-- ============================================
-- 3. 경쟁사 분석 캐시 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS competitor_analysis_cache (
    id SERIAL PRIMARY KEY,
    target_keyword VARCHAR(255) NOT NULL,

    -- 분석 결과
    discovered_keywords JSONB NOT NULL,
    -- 예: [{ "keyword": "남성운동화", "frequency": 15, "sources": ["product1", "product2"] }]

    competitor_count INTEGER DEFAULT 0,
    analysis_date DATE NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(target_keyword, analysis_date)
);

CREATE INDEX idx_competitor_analysis_cache_target_keyword ON competitor_analysis_cache(target_keyword);
CREATE INDEX idx_competitor_analysis_cache_analysis_date ON competitor_analysis_cache(analysis_date);

-- ============================================
-- 4. 트리거
-- ============================================

CREATE TRIGGER update_keyword_candidates_updated_at
    BEFORE UPDATE ON keyword_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 설정값 추가
-- ============================================

INSERT INTO settings (key, value, description) VALUES
('keyword_test_duration_days', '14', '키워드 테스트 기간 (일)'),
('keyword_test_success_days', '3', '테스트 성공 기준: 1페이지 연속 진입 일수'),
('max_concurrent_tests', '3', '동시 테스트 가능 키워드 수'),
('competitor_analysis_cache_days', '7', '경쟁사 분석 캐시 유효 기간 (일)'),
('extreme_early_search_limit', '1000', 'extreme_early 단계 검색량 상한'),
('growth_search_limit', '5000', 'growth 단계 검색량 상한'),
('min_competitor_frequency', '3', '경쟁사 키워드 최소 등장 횟수'),
('min_category_match_ratio', '0.3', '키워드 관련성 최소 카테고리 일치율'),
('enable_manual_approval', 'true', '수동 승인 활성화 여부')
ON CONFLICT (key) DO NOTHING;
