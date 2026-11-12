CREATE TABLE IF NOT EXISTS store_inventories (
  inventory_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  current_stock INT UNSIGNED NOT NULL DEFAULT 0,
  safety_stock INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (inventory_id),
  UNIQUE KEY uq_store_inventories_store_product (store_id, product_id),
  CONSTRAINT fk_store_inventories_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_store_inventories_product FOREIGN KEY (product_id) REFERENCES products (product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_store_inventories_current_stock_nonnegative CHECK (current_stock >= 0),
  CONSTRAINT chk_store_inventories_safety_stock_nonnegative CHECK (safety_stock >= 0)
) ENGINE=InnoDB;
