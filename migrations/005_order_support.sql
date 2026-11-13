-- 005_order_support.sql
-- 자동 발주 기능 지원 마이그레이션
-- 1) products: 리드타임(일), 발주 단위 컬럼 추가
-- 2) orders: 점포+상품+상태 조회/집계용 인덱스 추가
-- migrate.js는 모든 .sql을 매 실행마다 다시 수행하므로,
-- information_schema 가드 + PREPARE로 재실행 가능(멱등)하게 작성한다.

SET @add_lead_time_days = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND COLUMN_NAME = 'lead_time_days'
    ) = 0,
    'ALTER TABLE products ADD COLUMN lead_time_days INT UNSIGNED NOT NULL DEFAULT 1',
    'SELECT 1'
  )
);
PREPARE add_lead_time_days_stmt FROM @add_lead_time_days;
EXECUTE add_lead_time_days_stmt;
DEALLOCATE PREPARE add_lead_time_days_stmt;

SET @add_order_unit = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND COLUMN_NAME = 'order_unit'
    ) = 0,
    'ALTER TABLE products ADD COLUMN order_unit INT UNSIGNED NOT NULL DEFAULT 1',
    'SELECT 1'
  )
);
PREPARE add_order_unit_stmt FROM @add_order_unit;
EXECUTE add_order_unit_stmt;
DEALLOCATE PREPARE add_order_unit_stmt;

SET @add_check_lead_time = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND CONSTRAINT_NAME = 'chk_products_lead_time_days_positive'
    ) = 0,
    'ALTER TABLE products ADD CONSTRAINT chk_products_lead_time_days_positive CHECK (lead_time_days >= 1)',
    'SELECT 1'
  )
);
PREPARE add_check_lead_time_stmt FROM @add_check_lead_time;
EXECUTE add_check_lead_time_stmt;
DEALLOCATE PREPARE add_check_lead_time_stmt;

SET @add_check_order_unit = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND CONSTRAINT_NAME = 'chk_products_order_unit_positive'
    ) = 0,
    'ALTER TABLE products ADD CONSTRAINT chk_products_order_unit_positive CHECK (order_unit >= 1)',
    'SELECT 1'
  )
);
PREPARE add_check_order_unit_stmt FROM @add_check_order_unit;
EXECUTE add_check_order_unit_stmt;
DEALLOCATE PREPARE add_check_order_unit_stmt;

SET @add_orders_index = (
  SELECT IF(
    (
      SELECT COUNT(DISTINCT INDEX_NAME)
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND INDEX_NAME = 'idx_orders_store_product_status'
    ) = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_store_product_status (store_id, product_id, order_status)',
    'SELECT 1'
  )
);
PREPARE add_orders_index_stmt FROM @add_orders_index;
EXECUTE add_orders_index_stmt;
DEALLOCATE PREPARE add_orders_index_stmt;
