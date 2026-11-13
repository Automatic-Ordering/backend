require("dotenv").config();

const { sequelize } = require("../config/database");
const { Store } = require("../models");

const DEFAULT_RAND_MIN = 10;
const DEFAULT_RAND_MAX = 49;

const parseIntEnv = (name, { min, max, required = false, fallback } = {}) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    if (required) {
      throw new Error(
        `${name} 환경변수에 정수를 지정해야 합니다. 예) STORE_ID=10 node scripts/${"seed-inventory-stock"}.js`,
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

  const safetyStock = parseIntEnv("SAFETY_STOCK", { min: 0, max: 999999 });

  const store = await Store.findByPk(storeId);
  if (!store) {
    throw new Error(`점포를 찾을 수 없습니다. (store_id=${storeId})`);
  }

  const [rows] = await sequelize.query(
    "SELECT COUNT(*) AS total, COALESCE(MIN(current_stock), 0) AS minStock, COALESCE(MAX(current_stock), 0) AS maxStock FROM store_inventories WHERE store_id = :storeId",
    { replacements: { storeId } },
  );
  const target = rows[0];
  if (!target || Number(target.total) === 0) {
    throw new Error(
      `해당 점포에 등록된 재고 상품이 없습니다. (store_id=${storeId})`,
    );
  }

  const stockLabel = useRandom
    ? `랜덤 ${randMin}~${randMax}`
    : `고정 ${fixedStock}`;
  const safetyLabel =
    safetyStock === undefined ? "기존 유지" : `${safetyStock}`;

  console.log(
    "[Seed Inventory Stock] 점포:",
    `${store.storeName} (store_id=${storeId})`,
  );
  console.log("[Seed Inventory Stock] 대상 상품:", `${Number(target.total)}개`);
  console.log(
    "[Seed Inventory Stock] 변경 전 재고 범위:",
    `${Number(target.minStock)} ~ ${Number(target.maxStock)}`,
  );
  console.log(
    "[Seed Inventory Stock] 적용값: 현재 재고",
    stockLabel,
    "/ 안전재고",
    safetyLabel,
  );

  if (dryRun) {
    console.log(
      "[Seed Inventory Stock] DRY_RUN 모드 — 변경 없이 미리보기만 수행했습니다.",
    );
    return { updatedCount: 0, dryRun: true };
  }

  const stockExpression = useRandom
    ? "FLOOR(:randMin + RAND() * (:randMax - :randMin + 1))"
    : ":stock";
  const safetyClause =
    safetyStock === undefined ? "" : ", safety_stock = :safetyStock";
  const replacements = {
    storeId,
    ...(useRandom ? { randMin, randMax } : { stock: fixedStock }),
    ...(safetyStock !== undefined ? { safetyStock } : {}),
  };

  const updatedCount = await sequelize.transaction(async (transaction) => {
    const [result] = await sequelize.query(
      `UPDATE store_inventories SET current_stock = ${stockExpression}${safetyClause} WHERE store_id = :storeId`,
      { replacements, transaction },
    );
    return result.affectedRows;
  });

  const [afterRows] = await sequelize.query(
    "SELECT COALESCE(MIN(current_stock), 0) AS minStock, COALESCE(MAX(current_stock), 0) AS maxStock FROM store_inventories WHERE store_id = :storeId",
    { replacements: { storeId } },
  );
  const after = afterRows[0];

  console.log("========================================");
  console.log("[Seed Inventory Stock] 실행 완료");
  console.log(`- 업데이트: ${updatedCount}건`);
  console.log(
    `- 적용 후 재고 범위: ${Number(after.minStock)} ~ ${Number(after.maxStock)}`,
  );
  console.log("========================================");

  return { updatedCount, dryRun: false };
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
