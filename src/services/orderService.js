const { Op } = require("sequelize");
const { sequelize } = require("../../config/database");
const {
  Order,
  Product,
  Sales,
  Store,
  StoreInventory,
} = require("../../models");
const {
  calculateRecommendation,
  buildDailySeries,
  SALES_WINDOW_DAYS,
  FORECAST_PERIOD_DAYS,
} = require("./orderCalculator");
const { increaseStock } = require("./inventoryService");
const { createHttpError } = require("../utils/httpError");
const { validateConfirmItems } = require("../utils/orderValidation");
const {
  getStoreOrderSettings,
  serializeSetting,
} = require("./storeOrderSettingService");

const ORDER_STATUSES = ["PENDING", "ORDERED", "COMPLETED", "CANCELLED"];
const OPEN_ORDER_STATUSES = ["PENDING", "ORDERED"];
// 미입고(incoming) 수량에 포함할 발주 명세서 상태.
// REQUESTED(승인 대기), APPROVED(확정), ORDERED(구 버전 발주서 발행)는 아직 입고 전이다.
const OPEN_SPEC_STATUSES = ["REQUESTED", "APPROVED", "ORDERED"];
const HISTORY_LIMIT = 200;

const pad = (value) => String(value).padStart(2, "0");

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getSalesWindow = (analysisDays = SALES_WINDOW_DAYS) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - analysisDays);
  const windowEnd = new Date(today);
  windowEnd.setDate(today.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);
  return { windowStart, windowEnd };
};

const aggregateDailySales = (salesRows) => {
  const quantityByDate = new Map();
  salesRows.forEach(({ salesDate, salesQuantity }) => {
    const key = formatLocalDate(new Date(salesDate));
    quantityByDate.set(
      key,
      (quantityByDate.get(key) ?? 0) + Number(salesQuantity),
    );
  });
  return [...quantityByDate.keys()]
    .sort()
    .map((date) => ({ date, quantity: quantityByDate.get(date) }));
};

// 미입고 수량 집계.
// 기존 orders(구 confirm 플로우)와 order_specifications(명세서 플로우)는 서로 다른
// 레코드를 가리키는 두 개의 독립된 소스다. 한 발주가 두 테이블에 동시에 기록되는
// 경로는 없으므로 UNION ALL로 합산해도 동일 발주 수량이 두 번 집계되지 않는다.
const fetchIncomingQuantities = async (
  storeId,
  { productId, transaction } = {},
) => {
  const [rows] = await sequelize.query(
    `
      SELECT product_id, SUM(quantity) AS incoming_quantity
      FROM (
        SELECT product_id, SUM(order_quantity) AS quantity
        FROM orders
        WHERE store_id = :storeId
          AND order_status IN (:openOrderStatuses)
          ${productId ? "AND product_id = :productId" : ""}
        GROUP BY product_id
        UNION ALL
        SELECT item.product_id, SUM(item.order_quantity) AS quantity
        FROM order_specification_items item
        INNER JOIN order_specifications spec
          ON spec.order_spec_id = item.order_spec_id
        WHERE spec.store_id = :storeId
          AND spec.order_status IN (:openSpecStatuses)
          ${productId ? "AND item.product_id = :productId" : ""}
        GROUP BY item.product_id
      ) incoming
      GROUP BY product_id
    `,
    {
      replacements: {
        storeId,
        openOrderStatuses: OPEN_ORDER_STATUSES,
        openSpecStatuses: OPEN_SPEC_STATUSES,
        ...(productId ? { productId } : {}),
      },
      transaction,
    },
  );
  return new Map(
    rows.map((row) => [Number(row.product_id), Number(row.incoming_quantity)]),
  );
};

const serializeRecommendation = (
  product,
  inventory,
  recommendation,
  incomingQuantity,
  recentSalesQuantity,
) => ({
  product_id: product.productId,
  product_name: product.productName,
  category: product.category,
  price: Number(product.price),
  safety_stock: Number(inventory.safetyStock),
  current_stock: recommendation.currentStock,
  recent_sales_quantity: recentSalesQuantity,
  recent_7d_sales: recentSalesQuantity,
  incoming_quantity: incomingQuantity,
  predicted_demand: recommendation.predictedDemand,
  moving_average: recommendation.movingAverage,
  same_weekday_average: recommendation.sameWeekdayAverage,
  daily_std_dev: recommendation.dailyStdDev,
  sales_series_days: recommendation.salesSeriesDays,
  service_level_z: recommendation.serviceLevelZ,
  lead_time_days: recommendation.leadTimeDays,
  forecast_period_days: recommendation.forecastPeriodDays,
  forecast_coverage_days: recommendation.coverageDays,
  order_unit: recommendation.orderUnit,
  computed_safety_stock: recommendation.computedSafetyStock,
  configured_safety_stock: recommendation.configuredSafetyStock,
  applied_safety_stock: recommendation.appliedSafetyStock,
  safety_stock_source: recommendation.safetyStockSource,
  target_stock: recommendation.targetStock,
  raw_order_quantity: recommendation.rawOrderQuantity,
  order_quantity: recommendation.orderQuantity,
  recommended_qty: recommendation.orderQuantity,
  recommended_quantity: recommendation.orderQuantity,
  needs_order: recommendation.needsOrder,
  data_warning: recommendation.dataWarning,
});

const getRegisteredInventories = async (storeId, { productId } = {}) => {
  const where = { storeId };
  if (productId !== undefined) {
    where.productId = productId;
  }
  const inventories = await StoreInventory.findAll({
    where,
    include: [{ model: Product, as: "product" }],
    order: [["productId", "ASC"]],
  });
  return inventories.filter((inventory) => inventory.product);
};

const getOrderRecommendations = async (
  storeId,
  { page = 1, limit = 20, search } = {},
) => {
  const { windowStart, windowEnd } = getSalesWindow(SALES_WINDOW_DAYS);
  const { windowStart: recentWindowStart } = getSalesWindow(SALES_WINDOW_DAYS);
  const productWhere = search
    ? {
        [Op.or]: [
          { productName: { [Op.like]: `%${search}%` } },
          { category: { [Op.like]: `%${search}%` } },
        ],
      }
    : undefined;

  const buildProductInclude = () => ({
    model: Product,
    as: "product",
    ...(productWhere ? { where: productWhere, required: true } : {}),
  });

  const total = await StoreInventory.count({
    where: { storeId },
    ...(productWhere ? { include: [buildProductInclude()] } : {}),
  });

  if (!total) {
    return { recommendations: [], total: 0 };
  }

  const inventories = (
    await StoreInventory.findAll({
      where: { storeId },
      include: [buildProductInclude()],
      order: [["productId", "ASC"]],
      limit,
      offset: (page - 1) * limit,
    })
  ).filter((inventory) => inventory.product);

  if (!inventories.length) {
    return { recommendations: [], total };
  }

  const productIds = inventories.map((inventory) => inventory.productId);

  const salesRows = await Sales.findAll({
    where: {
      storeId,
      productId: { [Op.in]: productIds },
      salesDate: { [Op.gte]: windowStart, [Op.lte]: windowEnd },
    },
    attributes: ["productId", "salesQuantity", "salesDate"],
    raw: true,
  });

  const salesByProduct = new Map();
  salesRows.forEach((row) => {
    const productId = Number(row.productId);
    if (!salesByProduct.has(productId)) {
      salesByProduct.set(productId, []);
    }
    salesByProduct.get(productId).push(row);
  });

  const incomingByProduct = await fetchIncomingQuantities(storeId);

  const recommendations = inventories.map((inventory) => {
    const product = inventory.product;
    const productSales = salesByProduct.get(inventory.productId) ?? [];
    const dailySales = aggregateDailySales(productSales);
    const recentSalesQuantity = productSales
      .filter((sale) => new Date(sale.salesDate) >= recentWindowStart)
      .reduce((sum, sale) => sum + Number(sale.salesQuantity || 0), 0);
    const recommendation = calculateRecommendation({
      dailySales,
      currentStock: inventory.currentStock,
      incomingQuantity: incomingByProduct.get(inventory.productId) ?? 0,
      leadTimeDays: product.leadTimeDays,
      orderUnit: product.orderUnit,
      configuredSafetyStock: inventory.safetyStock,
    });
    return serializeRecommendation(
      product,
      inventory,
      recommendation,
      incomingByProduct.get(inventory.productId) ?? 0,
      recentSalesQuantity,
    );
  });

  return { recommendations, total };
};

const getRecommendationDetail = async (storeId, productId) => {
  const [inventory] = await getRegisteredInventories(storeId, { productId });
  if (!inventory) {
    throw createHttpError(
      404,
      "NOT_FOUND",
      "해당 상품은 이 점포의 재고에 등록되어 있지 않습니다.",
    );
  }

  const product = inventory.product;
  const settings = await getStoreOrderSettings(storeId);
  const { windowStart, windowEnd } = getSalesWindow(SALES_WINDOW_DAYS);
  const { windowStart: recentWindowStart } = getSalesWindow(SALES_WINDOW_DAYS);

  const salesRows = await Sales.findAll({
    where: {
      storeId,
      productId,
      salesDate: { [Op.gte]: windowStart, [Op.lte]: windowEnd },
    },
    attributes: ["productId", "salesQuantity", "salesDate"],
    raw: true,
  });

  const dailySales = aggregateDailySales(salesRows);
  const recentSalesQuantity = salesRows
    .filter((sale) => new Date(sale.salesDate) >= recentWindowStart)
    .reduce((sum, sale) => sum + Number(sale.salesQuantity || 0), 0);
  const series = buildDailySeries(dailySales);

  const incomingByProduct = await fetchIncomingQuantities(storeId, {
    productId,
  });
  const incomingQuantity = incomingByProduct.get(productId) ?? 0;

  const recommendation = calculateRecommendation({
    dailySales,
    currentStock: inventory.currentStock,
    incomingQuantity,
    leadTimeDays: product.leadTimeDays,
    orderUnit: product.orderUnit,
    configuredSafetyStock: inventory.safetyStock,
  });
  return {
    ...serializeRecommendation(
      product,
      inventory,
      recommendation,
      incomingQuantity,
      recentSalesQuantity,
    ),
    calculation_basis: {
      sales_window_days: SALES_WINDOW_DAYS,
      sales_series_days: series.length,
      analysis_days: SALES_WINDOW_DAYS,
      safety_stock_days: null,
      lead_time_days: null,
      forecast_period_days: FORECAST_PERIOD_DAYS,
      forecast_coverage_days: recommendation.coverageDays,
      same_weekday_sample_count: 0,
      recent_daily_sales: series.slice(-14).map((entry) => ({
        date: entry.key,
        quantity: entry.quantity,
      })),
    },
    applied_settings: serializeSetting(settings),
  };
};

const confirmOrders = async (storeId, items) => {
  const normalized = validateConfirmItems(items);
  const productIds = normalized.map((item) => item.productId);

  const inventories = await getRegisteredInventories(storeId);
  const registeredIds = new Set(
    inventories.map((inventory) => inventory.productId),
  );
  const unregistered = productIds.find(
    (productId) => !registeredIds.has(productId),
  );
  if (unregistered !== undefined) {
    throw createHttpError(
      404,
      "NOT_FOUND",
      `해당 상품은 이 점포의 재고에 등록되어 있지 않습니다. (product_id=${unregistered})`,
    );
  }

  const createdOrders = [];
  await sequelize.transaction(async (transaction) => {
    for (const { productId, quantity } of normalized) {
      const order = await Order.create(
        {
          storeId,
          productId,
          orderQuantity: quantity,
          orderStatus: "PENDING",
        },
        { transaction },
      );
      createdOrders.push(order);
    }
  });

  return createdOrders;
};

const serializeOrderRow = (order) => ({
  order_id: order.orderId,
  store_id: order.storeId,
  product_id: order.productId,
  product_name: order.product?.productName ?? null,
  category: order.product?.category ?? null,
  order_quantity: order.orderQuantity,
  order_status: order.orderStatus,
  created_at: order.createdAt,
  updated_at: order.updatedAt,
});

const getStoreOrders = async (
  storeId,
  { status, page = 1, limit = 20 } = {},
) => {
  const where = { storeId };
  if (status !== undefined) {
    where.orderStatus = status;
  }

  const total = await Order.count({ where });

  const orders = await Order.findAll({
    where,
    include: [{ model: Product, as: "product" }],
    order: [
      ["createdAt", "DESC"],
      ["orderId", "DESC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });

  return { orders, total };
};

const getStoreOrderDetail = async (storeId, orderId) => {
  const order = await Order.findOne({
    where: { orderId, storeId },
    include: [{ model: Product, as: "product" }],
  });

  if (!order) {
    throw createHttpError(404, "NOT_FOUND", "발주를 찾을 수 없습니다.");
  }

  return serializeOrderRow(order);
};

const ORDER_STATUS_TRANSITIONS = {
  PENDING: ["ORDERED", "CANCELLED"],
  ORDERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const updateOrderStatus = async (orderId, nextStatus) => {
  if (!ORDER_STATUSES.includes(nextStatus)) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      "status는 PENDING, ORDERED, COMPLETED, CANCELLED 중 하나여야 합니다.",
    );
  }

  const { order, stockIncreased } = await sequelize.transaction(
    async (transaction) => {
      const target = await Order.findOne({
        where: { orderId },
        transaction,
        lock: true,
      });

      if (!target) {
        throw createHttpError(404, "NOT_FOUND", "발주를 찾을 수 없습니다.");
      }

      const allowed = ORDER_STATUS_TRANSITIONS[target.orderStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw createHttpError(
          409,
          "INVALID_ORDER_STATUS",
          `${target.orderStatus} 상태에서 ${nextStatus} 상태로 변경할 수 없습니다.`,
        );
      }

      target.orderStatus = nextStatus;
      await target.save({ transaction });

      let increased = false;
      if (nextStatus === "COMPLETED") {
        try {
          await increaseStock({
            storeId: target.storeId,
            productId: target.productId,
            quantity: target.orderQuantity,
            transaction,
          });
        } catch (error) {
          if (error.code === "NOT_FOUND") {
            throw createHttpError(
              409,
              "INVALID_ORDER_STATUS",
              "재고 정보가 없어 입고 완료 처리를 할 수 없습니다.",
            );
          }
          throw error;
        }
        increased = true;
      }

      return { order: target, stockIncreased: increased };
    },
  );

  return { order, stockIncreased };
};

const getAdminOrders = async ({ storeId, status } = {}) => {
  const where = {};
  if (storeId !== undefined) {
    where.storeId = storeId;
  }
  if (status !== undefined) {
    where.orderStatus = status;
  }

  const orders = await Order.findAll({
    where,
    include: [
      { model: Product, as: "product" },
      { model: Store, as: "store", attributes: ["storeId", "storeName"] },
    ],
    order: [
      ["createdAt", "DESC"],
      ["orderId", "DESC"],
    ],
    limit: HISTORY_LIMIT,
  });

  return orders.map((order) => ({
    ...serializeOrderRow(order),
    store_name: order.store?.storeName ?? null,
  }));
};

const getAdminOrderDetail = async (orderId) => {
  const order = await Order.findOne({
    where: { orderId },
    include: [
      { model: Product, as: "product" },
      { model: Store, as: "store", attributes: ["storeId", "storeName"] },
    ],
  });

  if (!order) {
    throw createHttpError(404, "NOT_FOUND", "발주를 찾을 수 없습니다.");
  }

  return {
    ...serializeOrderRow(order),
    store_name: order.store?.storeName ?? null,
  };
};

module.exports = {
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  getAdminOrderDetail,
  getAdminOrders,
  getOrderRecommendations,
  getRecommendationDetail,
  getStoreOrderDetail,
  getStoreOrders,
  confirmOrders,
  updateOrderStatus,
  serializeOrderRow,
};
