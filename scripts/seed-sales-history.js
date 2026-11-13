require("dotenv").config();

const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const { Sales, Store, StoreInventory, Product } = require("../models");

const DAYS = 120;
const DEFAULT_SEED = 20261113;
const CHUNK_SIZE = 500;

const createRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pad = (value) => String(value).padStart(2, "0");

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfLocalDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getBaseQuantity = (productId) => 2 + (productId % 15);

const generateDailyQuantity = (random, baseQuantity, day) => {
  const weekday = day.getDay();
  const weekendFactor = weekday === 0 || weekday === 6 ? 2 : 1;
  const noise = 1 + (random() - 0.5) * 0.6;
  return Math.max(1, Math.round(baseQuantity * weekendFactor * noise));
};

const generateSaleTime = (random, day) => {
  const hour = 8 + Math.floor(random() * 15);
  const minute = Math.floor(random() * 60);
  const second = Math.floor(random() * 60);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
    second,
  );
};

const seedSalesHistory = async () => {
  const storeId = Number(process.env.STORE_ID);
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw new Error(
      "STORE_ID 환경변수에 판매 이력을 생성할 점포 ID(1 이상의 정수)를 지정해야 합니다.",
    );
  }

  const seed = Number(process.env.SEED) || DEFAULT_SEED;
  const random = createRandom(seed);

  const store = await Store.findByPk(storeId);
  if (!store) {
    throw new Error(`점포를 찾을 수 없습니다. (store_id=${storeId})`);
  }

  const inventories = await StoreInventory.findAll({
    where: { storeId },
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["productId", "productName"],
      },
    ],
  });

  const registeredProducts = inventories.filter(
    (inventory) => inventory.product,
  );
  if (!registeredProducts.length) {
    throw new Error(
      `해당 점포에 재고가 등록된 상품이 없습니다. (store_id=${storeId})`,
    );
  }

  const today = startOfLocalDay(new Date());
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - DAYS);
  const rangeEnd = today;

  const dayList = [];
  for (let offset = DAYS; offset >= 1; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    dayList.push(day);
  }

  const existingSales = await Sales.findAll({
    where: {
      storeId,
      salesDate: { [Op.gte]: rangeStart, [Op.lt]: rangeEnd },
    },
    attributes: ["productId", "salesDate"],
  });

  const existingKeys = new Set(
    existingSales.map(
      ({ productId, salesDate }) =>
        `${productId}:${formatLocalDate(salesDate)}`,
    ),
  );

  const rows = [];
  let skippedCount = 0;

  for (const inventory of registeredProducts) {
    const baseQuantity = getBaseQuantity(inventory.productId);
    for (const day of dayList) {
      const key = `${inventory.productId}:${formatLocalDate(day)}`;
      if (existingKeys.has(key)) {
        skippedCount += 1;
        continue;
      }
      rows.push({
        storeId,
        productId: inventory.productId,
        salesQuantity: generateDailyQuantity(random, baseQuantity, day),
        salesDate: generateSaleTime(random, day),
      });
    }
  }

  let createdCount = 0;
  await sequelize.transaction(async (transaction) => {
    for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
      const chunk = rows.slice(offset, offset + CHUNK_SIZE);
      await Sales.bulkCreate(chunk, { transaction, validate: true });
      createdCount += chunk.length;
    }
  });

  console.log(
    "[Seed Sales History] 점포:",
    `${store.storeName} (store_id=${storeId})`,
  );
  console.log(
    "[Seed Sales History] 대상 상품:",
    `${registeredProducts.length}개`,
  );
  console.log(
    "[Seed Sales History] 생성 기간:",
    `${formatLocalDate(rangeStart)} ~ ${formatLocalDate(dayList[dayList.length - 1])} (${DAYS}일, 오늘 제외)`,
  );
  console.log("[Seed Sales History] 랜덤 시드:", seed);
  console.log("========================================");
  console.log("[Seed Sales History] 실행 완료");
  console.log(`- 신규 생성: ${createdCount}건`);
  console.log(
    `- 건너뜀 (동일 점포·상품·날짜 기존 기록 존재): ${skippedCount}건`,
  );
  console.log("========================================");

  return { createdCount, skippedCount };
};

if (require.main === module) {
  seedSalesHistory()
    .catch((error) => {
      console.error("[Seed Sales History] 실행 실패:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = { seedSalesHistory };
