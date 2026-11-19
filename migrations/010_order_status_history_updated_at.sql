-- 010_order_status_history_updated_at.sql
-- 기존 order_status_histories 테이블에 updated_at이 없으면 멱등하게 추가한다.

SET @add_order_status_history_updated_at = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'order_status_histories'
        AND COLUMN_NAME = 'updated_at'
    ) = 0,
    'ALTER TABLE order_status_histories ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'SELECT 1'
  )
);
PREPARE add_order_status_history_updated_at_stmt FROM @add_order_status_history_updated_at;
EXECUTE add_order_status_history_updated_at_stmt;
DEALLOCATE PREPARE add_order_status_history_updated_at_stmt;
