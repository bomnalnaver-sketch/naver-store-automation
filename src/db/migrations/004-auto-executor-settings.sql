-- 자동 실행 관련 설정 추가
-- 관련 파일: src/services/auto-executor/index.ts

-- ============================================
-- 1. 설정값 추가
-- ============================================

INSERT INTO settings (key, value, description) VALUES
('execution_mode', '"manual_approval"', '자동 실행 모드 (auto: 완전 자동, manual_approval: 수동 승인)'),
('auto_execution_max_per_day', '10', '하루 최대 자동 실행 횟수'),
('auto_execution_last_run', 'null', '마지막 자동 실행 시간'),
('pending_bid_adjustments', '[]', '대기 중인 입찰가 조정 목록')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. product_ab_tests 상태에 'applied' 추가 확인
-- (PostgreSQL에서는 status 컬럼이 VARCHAR이므로 별도 변경 불필요)
-- ============================================

-- 상태 체크용 주석:
-- product_ab_tests.status: running, completed, stopped, applied

-- ============================================
-- 3. 자동 실행 이력 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS auto_execution_logs (
    id SERIAL PRIMARY KEY,

    -- 실행 시간
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 실행 결과
    execution_mode VARCHAR(20) NOT NULL,  -- auto, manual_approval

    -- 상품명 변경
    product_name_applied INTEGER DEFAULT 0,
    product_name_failed INTEGER DEFAULT 0,

    -- AI 결정
    ai_decisions_executed INTEGER DEFAULT 0,
    ai_decisions_failed INTEGER DEFAULT 0,

    -- 입찰가 조정
    bid_adjustments_applied INTEGER DEFAULT 0,
    bid_adjustments_failed INTEGER DEFAULT 0,

    -- 상세 결과
    details JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auto_execution_logs_executed_at ON auto_execution_logs(executed_at);
