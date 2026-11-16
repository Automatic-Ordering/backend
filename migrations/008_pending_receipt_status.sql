-- Add the store-owned pending receipt status without changing existing data.
ALTER TABLE order_specifications
  MODIFY COLUMN order_status ENUM(
    'DRAFT',
    'PENDING_RECEIPT',
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'ORDERED',
    'RECEIVED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT';

SET @add_confirmed_at = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'order_specifications'
        AND COLUMN_NAME = 'confirmed_at'
    ) = 0,
    'ALTER TABLE order_specifications ADD COLUMN confirmed_at DATETIME NULL AFTER approved_at',
    'SELECT 1'
  )
);
PREPARE add_confirmed_at_stmt FROM @add_confirmed_at;
EXECUTE add_confirmed_at_stmt;
DEALLOCATE PREPARE add_confirmed_at_stmt;

ALTER TABLE order_status_histories
  MODIFY COLUMN from_status ENUM(
    'DRAFT',
    'PENDING_RECEIPT',
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'ORDERED',
    'RECEIVED',
    'CANCELLED'
  ) NULL,
  MODIFY COLUMN to_status ENUM(
    'DRAFT',
    'PENDING_RECEIPT',
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'ORDERED',
    'RECEIVED',
    'CANCELLED'
  ) NOT NULL;
