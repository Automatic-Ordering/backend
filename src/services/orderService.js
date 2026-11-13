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
} = require("./orderCalculator");

const ORDER_STATUSES = ["PENDING", "ORDERED", "COMPLETED", "CANCELLED"];
const OPEN_ORDER_STATUSES = ["PENDING", "ORDERED"];
const HISTORY_LIMIT = 200;

const pad = (value) => String(value).padStart(2, "0");

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const createHttpError = (statusCode, code, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const getSalesWindow = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - SALES_WINDOW_DAYS);
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

const fetchIncomingQuantities = async (
  storeId,
  { productId, transaction } = {},
) => {
  const [rows] = await sequelize.query(
    `
      SELECT product_id, COALESCE(SUM(order_quantity), 0) AS incoming_quantity
      FROM orders
      WHERE store_id = :storeId
        AND order_status IN (:openStatuses)
        ${productId ? "AND product_id = :productId" : ""}
      GROUP BY product_id
    `,
    {
      replacements: {
        storeId,
        openStatuses: OPEN_ORDER_STATUSES,
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
) => ({
  product_id: product.productId,
  product_name: product.productName,
  category: product.category,
  price: Number(product.price),
  current_stock: recommendation.currentStock,
  incoming_quantity: incomingQuantity,
  predicted_demand: recommendation.predictedDemand,
  moving_average: recommendation.movingAverage,
  same_weekday_average: recommendation.sameWeekdayAverage,
  daily_std_dev: recommendation.dailyStdDev,
  sales_series_days: recommendation.salesSeriesDays,
  service_level_z: recommendation.serviceLevelZ,
  lead_time_days: recommendation.leadTimeDays,
  order_unit: recommendation.orderUnit,
  computed_safety_stock: recommendation.computedSafetyStock,
  configured_safety_stock: recommendation.configuredSafetyStock,
  applied_safety_stock: recommendation.appliedSafetyStock,
  safety_stock_source: recommendation.safetyStockSource,
  target_stock: recommendation.targetStock,
  raw_order_quantity: recommendation.rawOrderQuantity,
  order_quantity: recommendation.orderQuantity,
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

  const { windowStart, windowEnd } = getSalesWindow();
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
    const dailySales = aggregateDailySales(
      salesByProduct.get(inventory.productId) ?? [],
    );
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
  const { windowStart, windowEnd } = getSalesWindow();

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

  const lastSaleDate = series.length ? series[series.length - 1].key : null;
  const targetWeekday = lastSaleDate
    ? (() => {
        const [year, month, day] = lastSaleDate.split("-").map(Number);
        const nextDay = new Date(year, month - 1, day + 1);
        return nextDay.getDay();
      })()
    : null;

  const sameWeekdaySampleCount =
    targetWeekday === null
      ? 0
      : series.filter((entry) => {
          const entryDate = (() => {
            const [entryYear, entryMonth, entryDay] = entry.key
              .split("-")
              .map(Number);
            return new Date(entryYear, entryMonth - 1, entryDay);
          })();
          return entryDate.getDay() === targetWeekday;
        }).length;

  return {
    ...serializeRecommendation(
      product,
      inventory,
      recommendation,
      incomingQuantity,
    ),
    calculation_basis: {
      sales_window_days: SALES_WINDOW_DAYS,
      sales_series_days: series.length,
      moving_average_sample_days: Math.min(7, series.length),
      same_weekday_sample_count: sameWeekdaySampleCount,
      recent_daily_sales: series.slice(-14).map((entry) => ({
        date: entry.key,
        quantity: entry.quantity,
      })),
    },
  };
};

const validateConfirmItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      "발주할 상품 목록(items)이 비어 있거나 올바르지 않습니다.",
    );
  }

  const seenProductIds = new Set();
  const normalized = items.map((item, index) => {
    const productId = Number(item?.product_id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `items[${index}].product_id는 1 이상의 정수여야 합니다.`,
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `items[${index}].quantity는 1 이상의 정수여야 합니다.`,
      );
    }
    if (seenProductIds.has(productId)) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `중복된 상품이 포함되어 있습니다. (product_id=${productId})`,
      );
    }
    seenProductIds.add(productId);
    return { productId, quantity };
  });

  return normalized;
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
        const inventory = await StoreInventory.findOne({
          where: { storeId: target.storeId, productId: target.productId },
          transaction,
          lock: true,
        });
        if (!inventory) {
          throw createHttpError(
            409,
            "INVALID_ORDER_STATUS",
            "재고 정보가 없어 입고 완료 처리를 할 수 없습니다.",
          );
        }
        await inventory.increment("currentStock", {
          by: target.orderQuantity,
          transaction,
        });
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
