-- 009_simplify_store_order_settings.sql
-- 기존 테이블의 레거시 컬럼과 CHECK 제약조건은 다른 설정 또는 기존 데이터가 의존할 수 있으므로 유지한다.
-- 새 Sequelize 컬럼만 현재 DB에 없을 때 추가한다.

SET @add_analysis_days = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'store_order_settings'
        AND COLUMN_NAME = 'analysis_days'
    ) = 0,
    'ALTER TABLE store_order_settings ADD COLUMN analysis_days INT UNSIGNED NOT NULL DEFAULT 7',
    'SELECT 1'
  )
);
PREPARE add_analysis_days_stmt FROM @add_analysis_days;
EXECUTE add_analysis_days_stmt;
DEALLOCATE PREPARE add_analysis_days_stmt;

SET @add_safety_stock_days = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'store_order_settings'
        AND COLUMN_NAME = 'safety_stock_days'
    ) = 0,
    'ALTER TABLE store_order_settings ADD COLUMN safety_stock_days INT UNSIGNED NOT NULL DEFAULT 2',
    'SELECT 1'
  )
);
PREPARE add_safety_stock_days_stmt FROM @add_safety_stock_days;
EXECUTE add_safety_stock_days_stmt;
DEALLOCATE PREPARE add_safety_stock_days_stmt;

SET @add_lead_time_days = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'store_order_settings'
        AND COLUMN_NAME = 'lead_time_days'
    ) = 0,
    'ALTER TABLE store_order_settings ADD COLUMN lead_time_days INT UNSIGNED NOT NULL DEFAULT 1',
    'SELECT 1'
  )
);
PREPARE add_lead_time_days_stmt FROM @add_lead_time_days;
EXECUTE add_lead_time_days_stmt;
DEALLOCATE PREPARE add_lead_time_days_stmt;

SET @add_check_store_order_settings_positive = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'store_order_settings'
        AND CONSTRAINT_NAME = 'chk_store_order_settings_positive'
    ) = 0,
    'ALTER TABLE store_order_settings ADD CONSTRAINT chk_store_order_settings_positive CHECK (analysis_days >= 1 AND safety_stock_days >= 0 AND lead_time_days >= 0)',
    'SELECT 1'
  )
);
PREPARE add_check_store_order_settings_positive_stmt FROM @add_check_store_order_settings_positive;
EXECUTE add_check_store_order_settings_positive_stmt;
DEALLOCATE PREPARE add_check_store_order_settings_positive_stmt;
