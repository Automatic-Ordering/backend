require("dotenv").config();

const { sequelize } = require("../config/database");
const { Store } = require("../models");

const DEFAULT_RAND_MIN = 10;
const DEFAULT_RAND_MAX = 49;
const DEFAULT_SAFETY_STOCK = 10;

const parseIntEnv = (name, { min, max, required = false, fallback } = {}) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    if (required) {
      throw new Error(
        `${name} 환경변수에 정수를 지정해야 합니다. 예) STORE_ID=5 node scripts/seed-inventory-stock.js`,
      );
    }
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `${name} 환경변수는 ${min} 이상 ${max} 이하의 정수여야 합니다. (입력값: ${raw})`,
    );
  }
  return value;
};

const seedInventoryStock = async () => {
  const storeId = parseIntEnv("STORE_ID", {
    min: 1,
    max: 2147483647,
    required: true,
  });
  const dryRun = process.env.DRY_RUN === "1";

  const fixedStock = parseIntEnv("STOCK", { min: 0, max: 999999 });
  const useRandom = fixedStock === undefined;
  const randMin = useRandom
    ? parseIntEnv("RAND_MIN", {
        min: 0,
        max: 999999,
        fallback: DEFAULT_RAND_MIN,
      })
    : undefined;
  const randMax = useRandom
    ? parseIntEnv("RAND_MAX", {
        min: 0,
        max: 999999,
        fallback: DEFAULT_RAND_MAX,
      })
    : undefined;
  if (useRandom && randMax < randMin) {
    throw new Error("RAND_MAX는 RAND_MIN보다 크거나 같아야 합니다.");
  }

  const safetyStock = parseIntEnv("SAFETY_STOCK", {
    min: 0,
    max: 999999,
    fallback: DEFAULT_SAFETY_STOCK,
  });

  const store = await Store.findByPk(storeId);
  if (!store) {
    throw new Error(`점포를 찾을 수 없습니다. (store_id=${storeId})`);
  }

  const [productCountRows] = await sequelize.query(
    "SELECT COUNT(*) AS total FROM products",
  );
  const totalProducts = Number(productCountRows[0]?.total || 0);
  if (totalProducts === 0) {
    throw new Error(
      "products 테이블에 등록된 상품이 없습니다. 100개 상품 시드 SQL을 먼저 실행하세요.",
    );
  }

  const stockLabel = useRandom
    ? `랜덤 ${randMin}~${randMax}`
    : `고정 ${fixedStock}`;

  console.log(
    "[Seed Inventory Stock] 점포:",
    `${store.storeName} (store_id=${storeId})`,
  );
  console.log("[Seed Inventory Stock] 전체 마스터 상품:", `${totalProducts}개`);
  console.log(
    "[Seed Inventory Stock] 적용값: 현재 재고",
    stockLabel,
    "/ 안전재고",
    `${safetyStock}`,
  );

  if (dryRun) {
    console.log(
      "[Seed Inventory Stock] DRY_RUN 모드 — 변경 없이 미리보기만 수행했습니다.",
    );
    return { insertedCount: 0, updatedCount: 0, dryRun: true };
  }

  const stockExpression = useRandom
    ? "FLOOR(:randMin + RAND() * (:randMax - :randMin + 1))"
    : ":stock";

  const replacements = {
    storeId,
    safetyStock,
    ...(useRandom ? { randMin, randMax } : { stock: fixedStock }),
  };

  const { insertedCount, updatedCount } = await sequelize.transaction(
    async (transaction) => {
      // 1. products 테이블의 최신 상품 중 해당 점포에 미등록된 상품을 먼저 store_inventories에 등록
      const [insertResult] = await sequelize.query(
        `INSERT INTO store_inventories (store_id, product_id, current_stock, safety_stock, created_at, updated_at)
         SELECT :storeId, p.product_id, 0, :safetyStock, NOW(), NOW()
         FROM products p
         WHERE NOT EXISTS (
           SELECT 1 FROM store_inventories si
           WHERE si.store_id = :storeId AND si.product_id = p.product_id
         )`,
        { replacements, transaction },
      );

      // 2. 해당 점포의 모든 재고 수량 및 안전 재고 일괄 갱신
      const [updateResult] = await sequelize.query(
        `UPDATE store_inventories
         SET current_stock = ${stockExpression},
             safety_stock = :safetyStock,
             updated_at = NOW()
         WHERE store_id = :storeId`,
        { replacements, transaction },
      );

      return {
        insertedCount: insertResult.affectedRows || 0,
        updatedCount: updateResult.affectedRows || 0,
      };
    },
  );

  const [afterRows] = await sequelize.query(
    "SELECT COUNT(*) AS total, COALESCE(MIN(current_stock), 0) AS minStock, COALESCE(MAX(current_stock), 0) AS maxStock FROM store_inventories WHERE store_id = :storeId",
    { replacements: { storeId } },
  );
  const after = afterRows[0];

  console.log("========================================");
  console.log("[Seed Inventory Stock] 실행 완료");
  console.log(`- 신규 점포 상품 등록: ${insertedCount}건`);
  console.log(`- 재고 수량 업데이트: ${updatedCount}건`);
  console.log(
    `- 적용 후 총 등록 상품: ${Number(after.total)}개 (재고 범위: ${Number(after.minStock)} ~ ${Number(after.maxStock)})`,
  );
  console.log("========================================");

  return { insertedCount, updatedCount, dryRun: false };
};

if (require.main === module) {
  seedInventoryStock()
    .catch((error) => {
      console.error("[Seed Inventory Stock] 실행 실패:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = { seedInventoryStock };