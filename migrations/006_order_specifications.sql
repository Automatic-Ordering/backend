-- 006_order_specifications.sql
-- 발주 명세서 및 본사 승인 시스템 마이그레이션
-- 1) order_specifications: 발주 명세서/발주서 기본 정보 (승인, 반려, 발행, 입고 정보 포함)
-- 2) order_specification_items: 발주 상품 상세 정보 (상품명/단가 스냅샷, 입고 수량 포함)
-- 3) order_status_histories: 발주 상태 변경 이력
-- 기존 테이블은 변경하지 않는다.
-- migrate.js는 모든 .sql을 매 실행마다 다시 수행하므로
-- CREATE TABLE IF NOT EXISTS로 재실행 가능(멱등)하게 작성한다.

CREATE TABLE IF NOT EXISTS order_specifications (
  order_spec_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(32) NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  order_status ENUM('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  request_date DATETIME NULL,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  admin_id BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  issued_order_number VARCHAR(32) NULL,
  issued_at DATETIME NULL,
  received_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_spec_id),
  UNIQUE KEY uq_order_specifications_number (order_number),
  KEY idx_order_specifications_store_status (store_id, order_status),
  KEY idx_order_specifications_admin (admin_id),
  CONSTRAINT fk_order_specifications_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_order_specifications_admin FOREIGN KEY (admin_id) REFERENCES admins (admin_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_specification_items (
  order_spec_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_spec_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  order_quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  received_quantity INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_spec_item_id),
  UNIQUE KEY uq_order_spec_items_spec_product (order_spec_id, product_id),
  CONSTRAINT fk_order_spec_items_spec FOREIGN KEY (order_spec_id) REFERENCES order_specifications (order_spec_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_order_spec_items_product FOREIGN KEY (product_id) REFERENCES products (product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_order_spec_items_quantity_positive CHECK (order_quantity >= 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_status_histories (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_spec_id BIGINT UNSIGNED NOT NULL,
  from_status ENUM('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'CANCELLED') NULL,
  to_status ENUM('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'ORDERED', 'RECEIVED', 'CANCELLED') NOT NULL,
  changed_by_admin_id BIGINT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  KEY idx_order_status_histories_spec (order_spec_id),
  CONSTRAINT fk_order_status_histories_spec FOREIGN KEY (order_spec_id) REFERENCES order_specifications (order_spec_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
