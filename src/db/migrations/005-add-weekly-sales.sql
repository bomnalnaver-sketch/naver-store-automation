-- =============================================
-- 005: 상품 주간 판매량 컬럼 추가
-- =============================================

-- products 테이블에 주간 판매량 관련 컬럼 추가
ALTER TABLE products
ADD COLUMN IF NOT EXISTS weekly_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_sales_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN products.weekly_orders IS '최근 7일 주문 건수';
COMMENT ON COLUMN products.weekly_sales IS '최근 7일 매출액 (원)';
COMMENT ON COLUMN products.weekly_sales_updated_at IS '주간 판매량 마지막 업데이트 시간';

-- 인덱스 추가 (판매량 순 정렬용)
CREATE INDEX IF NOT EXISTS idx_products_weekly_orders ON products(weekly_orders DESC);
CREATE INDEX IF NOT EXISTS idx_products_weekly_sales ON products(weekly_sales DESC);
