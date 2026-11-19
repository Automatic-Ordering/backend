-- 007_store_order_settings.sql
-- 점포별 자동 발주 기준 설정 테이블
-- 1) store_order_settings: 점포별 자동 발주 계산 기준 (점포당 1행, UNIQUE)
-- 기존 테이블은 변경하지 않는다. StoreInventory.safety_stock, products.lead_time_days,
-- products.order_unit은 그대로 유지한다.
-- migrate.js는 모든 .sql을 매 실행마다 다시 수행하므로
-- 재실행 가능(멱등)하게 작성한다.

CREATE TABLE IF NOT EXISTS store_order_settings (
  setting_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id BIGINT UNSIGNED NOT NULL,
  analysis_days INT UNSIGNED NOT NULL DEFAULT 7,
  safety_stock_days INT UNSIGNED NOT NULL DEFAULT 2,
  lead_time_days INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_id),
  UNIQUE KEY uq_store_order_settings_store (store_id),
  CONSTRAINT fk_store_order_settings_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_store_order_settings_positive CHECK (
    analysis_days >= 1
    AND safety_stock_days >= 0
    AND lead_time_days >= 0
  )
) ENGINE=InnoDB;

-- 기존 모든 점포에 기본 설정을 생성한다 (재실행 시 중복 생성되지 않는다).
INSERT INTO store_order_settings (store_id)
SELECT s.store_id
FROM stores s
WHERE NOT EXISTS (
  SELECT 1
  FROM store_order_settings o
  WHERE o.store_id = s.store_id
);
