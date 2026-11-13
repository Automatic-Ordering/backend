const { sequelize } = require("../../config/database");
const {
  OrderSpecification,
  OrderSpecificationItem,
  OrderStatusHistory,
  Product,
  Store,
  StoreInventory,
} = require("../../models");
const { getOrderRecommendations } = require("./orderService");

const SPEC_STATUSES = [
  "DRAFT",
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "ORDERED",
  "RECEIVED",
  "CANCELLED",
];

const SPEC_STATUS_TRANSITIONS = {
  DRAFT: ["REQUESTED", "CANCELLED"],
  REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ORDERED"],
  REJECTED: [],
  ORDERED: ["RECEIVED"],
  RECEIVED: [],
  CANCELLED: [],
};

const MAX_SPEC_ITEMS = 500;
const RECOMMENDATION_PAGE_LIMIT = 100;

const pad = (value) => String(value).padStart(2, "0");

const createHttpError = (statusCode, code, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const roundAmount = (value) => Math.round(value * 100) / 100;

const buildOrderNumber = (prefix, orderSpecId, date = new Date()) =>
  `${prefix}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${String(orderSpecId).padStart(6, "0")}`;

const assertTransition = (currentStatus, nextStatus) => {
  const allowed = SPEC_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw createHttpError(
      409,
      "INVALID_SPEC_STATUS",
      `${currentStatus} 상태에서 ${nextStatus} 상태로 변경할 수 없습니다.`,
    );
  }
};

const applyTransition = async (
  spec,
  nextStatus,
  { transaction, adminId = null, note, extraFields = {} },
) => {
  const fromStatus = spec.orderStatus;
  assertTransition(fromStatus, nextStatus);

  await spec.update({ orderStatus: nextStatus, ...extraFields }, { transaction });
  const history = await OrderStatusHistory.create(
    {
      orderSpecId: spec.orderSpecId,
      fromStatus,
      toStatus: nextStatus,
      changedByAdminId: adminId,
      note,
    },
    { transaction },
  );
  return { spec, history };
};

const normalizeSpecItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      "발주 항목(items)은 1개 이상의 배열이어야 합니다.",
    );
  }
  if (items.length > MAX_SPEC_ITEMS) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      `items는 한 번에 최대 ${MAX_SPEC_ITEMS}개까지 발주할 수 있습니다.`,
    );
  }

  const seenProductIds = new Set();
  return items.map((item, index) => {
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
};

const resolveSpecItems = async (storeId, normalizedItems) => {
  const inventories = await StoreInventory.findAll({
    where: { storeId },
    include: [{ model: Product, as: "product" }],
  });

  const productByProductId = new Map();
  for (const inventory of inventories) {
    if (inventory.product) {
      productByProductId.set(inventory.productId, inventory.product);
    }
  }

  return normalizedItems.map(({ productId, quantity }) => {
    const product = productByProductId.get(productId);
    if (!product) {
      throw createHttpError(
        404,
        "NOT_FOUND",
        `해당 상품은 이 점포의 재고에 등록되어 있지 않습니다. (product_id=${productId})`,
      );
    }
    const unitPrice = Number(product.price);
    const amount = roundAmount(quantity * unitPrice);
    return {
      productId,
      productName: product.productName,
      quantity,
      unitPrice,
      amount,
    };
  });
};

const buildRecommendedItems = async (storeId) => {
  const collected = [];
  let page = 1;
  let total = 0;

  do {
    const { recommendations, total: totalCount } = await getOrderRecommendations(
      storeId,
      { page, limit: RECOMMENDATION_PAGE_LIMIT },
    );
    total = totalCount;
    collected.push(
      ...recommendations.filter(
        (recommendation) =>
          recommendation.needs_order && recommendation.order_quantity > 0,
      ),
    );
    page += 1;
  } while ((page - 1) * RECOMMENDATION_PAGE_LIMIT < total);

  return collected.map((recommendation) => ({
    productId: recommendation.product_id,
    quantity: recommendation.order_quantity,
  }));
};

const serializeSpecItem = (item) => ({
  item_id: item.orderSpecItemId,
  product_id: item.productId,
  product_name: item.productName,
  order_quantity: item.orderQuantity,
  unit_price: Number(item.unitPrice),
  amount: Number(item.amount),
  received_quantity:
    item.receivedQuantity === null || item.receivedQuantity === undefined
      ? null
      : Number(item.receivedQuantity),
});

const serializeSpecHistory = (history) => ({
  history_id: history.historyId,
  from_status: history.fromStatus ?? null,
  to_status: history.toStatus,
  changed_by_admin_id: history.changedByAdminId ?? null,
  note: history.note ?? null,
  created_at: history.createdAt,
});

const serializeSpec = (spec, { includeItems = false } = {}) => ({
  order_spec_id: spec.orderSpecId,
  order_number: spec.orderNumber,
  store_id: spec.storeId,
  store_name: spec.store?.storeName ?? null,
  order_status: spec.orderStatus,
  request_date: spec.requestDate,
  total_amount: Number(spec.totalAmount),
  admin_id: spec.adminId ?? null,
  approved_at: spec.approvedAt,
  rejected_at: spec.rejectedAt,
  rejection_reason: spec.rejectionReason,
  issued_order_number: spec.issuedOrderNumber,
  issued_at: spec.issuedAt,
  received_at: spec.receivedAt,
  ...(Array.isArray(spec.items) ? { item_count: spec.items.length } : {}),
  created_at: spec.createdAt,
  updated_at: spec.updatedAt,
  ...(includeItems
    ? {
        items: (spec.items ?? []).map(serializeSpecItem),
        status_histories: (spec.statusHistories ?? []).map(serializeSpecHistory),
      }
    : {}),
});

const createOrderSpec = async (storeId, { items } = {}) => {
  let normalizedItems;
  if (items !== undefined && items !== null) {
    normalizedItems = normalizeSpecItems(items);
  } else {
    normalizedItems = await buildRecommendedItems(storeId);
    if (normalizedItems.length === 0) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        "발주 대상 상품이 없어 발주 명세서를 생성할 수 없습니다.",
      );
    }
  }

  const resolvedItems = await resolveSpecItems(storeId, normalizedItems);
  const totalAmount = roundAmount(
    resolvedItems.reduce((sum, item) => sum + item.amount, 0),
  );

  const spec = await sequelize.transaction(async (transaction) => {
    const created = await OrderSpecification.create(
      { storeId, orderStatus: "DRAFT", totalAmount },
      { transaction },
    );
    const orderNumber = buildOrderNumber("OS", created.orderSpecId);
    await created.update({ orderNumber }, { transaction });

    const itemRows = await OrderSpecificationItem.bulkCreate(
      resolvedItems.map((item) => ({
        orderSpecId: created.orderSpecId,
        productId: item.productId,
        productName: item.productName,
        orderQuantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
      { transaction },
    );

    const history = await OrderStatusHistory.create(
      {
        orderSpecId: created.orderSpecId,
        fromStatus: null,
        toStatus: "DRAFT",
        changedByAdminId: null,
        note: "발주 명세서 생성",
      },
      { transaction },
    );

    created.items = itemRows;
    created.statusHistories = [history];
    return created;
  });

  return serializeSpec(spec, { includeItems: true });
};

const updateOrderSpecItems = async (storeId, orderSpecId, items) => {
  const normalizedItems = normalizeSpecItems(items);
  const resolvedItems = await resolveSpecItems(storeId, normalizedItems);

  const spec = await sequelize.transaction(async (transaction) => {
    const target = await OrderSpecification.findOne({
      where: { orderSpecId, storeId },
      transaction,
      lock: true,
    });
    if (!target) {
      throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
    }
    if (target.orderStatus !== "DRAFT") {
      throw createHttpError(
        409,
        "SPEC_NOT_EDITABLE",
        "제출된 발주 명세서는 상품과 수량을 변경할 수 없습니다.",
      );
    }

    await OrderSpecificationItem.destroy({
      where: { orderSpecId },
      transaction,
    });

    const itemRows = await OrderSpecificationItem.bulkCreate(
      resolvedItems.map((item) => ({
        orderSpecId,
        productId: item.productId,
        productName: item.productName,
        orderQuantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
      { transaction },
    );

    const totalAmount = roundAmount(
      resolvedItems.reduce((sum, item) => sum + item.amount, 0),
    );
    await target.update({ totalAmount }, { transaction });

    target.items = itemRows;
    return target;
  });

  return serializeSpec(spec, { includeItems: true });
};

const submitOrderSpec = async (storeId, orderSpecId) =>
  sequelize.transaction(async (transaction) => {
    const spec = await OrderSpecification.findOne({
      where: { orderSpecId, storeId },
      include: [{ model: OrderSpecificationItem, as: "items" }],
      transaction,
      lock: true,
    });
    if (!spec) {
      throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
    }
    if (!spec.items || spec.items.length === 0) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        "발주 항목이 없어 제출할 수 없습니다.",
      );
    }

    const { spec: updated } = await applyTransition(spec, "REQUESTED", {
      transaction,
      note: "발주 요청 제출",
      extraFields: { requestDate: new Date() },
    });
    return serializeSpec(updated);
  });

const cancelOrderSpec = async (storeId, orderSpecId) =>
  sequelize.transaction(async (transaction) => {
    const spec = await OrderSpecification.findOne({
      where: { orderSpecId, storeId },
      transaction,
      lock: true,
    });
    if (!spec) {
      throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
    }

    const { spec: updated } = await applyTransition(spec, "CANCELLED", {
      transaction,
      note: "점포 취소",
    });
    return serializeSpec(updated);
  });

const approveOrderSpec = async (orderSpecId, adminId) =>
  sequelize.transaction(async (transaction) => {
    const spec = await OrderSpecification.findOne({
      where: { orderSpecId },
      transaction,
      lock: true,
    });
    if (!spec) {
      throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
    }

    const { spec: updated } = await applyTransition(spec, "APPROVED", {
      transaction,
      adminId,
      note: "본사 승인",
      extraFields: { adminId, approvedAt: new Date() },
    });
    return serializeSpec(updated);
  });

const rejectOrderSpec = async (orderSpecId, adminId, reason) => {
  const trimmedReason = typeof reason === "string" ? reason.trim() : "";
  if (!trimmedReason) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      "반려 사유(reason)는 필수입니다.",
    );
  }
  const safeReason = trimmedReason.slice(0, 500);

  return sequelize.transaction(async (transaction) => {
    const spec = await OrderSpecification.findOne({
      where: { orderSpecId },
      transaction,
      lock: true,
    });
    if (!spec) {
      throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
    }

    const { spec: updated } = await applyTransition(spec, "REJECTED", {
      transaction,
      adminId,
      note: `본사 반려: ${safeReason}`,
      extraFields: { adminId, rejectedAt: new Date(), rejectionReason: safeReason },
    });
    return serializeSpec(updated);
  });
};

const issueOrderSpec = async (orderSpecId, adminId) =>
  sequelize.transaction(async (transaction) => {
    const spec = await OrderSpecification.findOne({
      where: { orderSpecId },
      transaction,
      lock: true,
    });
    if (!spec) {
      throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
    }

    const now = new Date();
    const { spec: updated } = await applyTransition(spec, "ORDERED", {
      transaction,
      adminId,
      note: "발주서 발행",
      extraFields: {
        issuedOrderNumber: buildOrderNumber("PO", spec.orderSpecId, now),
        issuedAt: now,
      },
    });
    return serializeSpec(updated);
  });

const normalizeReceivedItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      "입고 수량 목록(items)은 1개 이상의 배열이어야 합니다.",
    );
  }

  const seenProductIds = new Set();
  return items.map((item, index) => {
    const productId = Number(item?.product_id);
    const receivedQuantity = Number(item?.received_quantity);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `items[${index}].product_id는 1 이상의 정수여야 합니다.`,
      );
    }
    if (!Number.isInteger(receivedQuantity) || receivedQuantity < 0) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `items[${index}].received_quantity는 0 이상의 정수여야 합니다.`,
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
    return { productId, receivedQuantity };
  });
};

const receiveOrderSpec = async (storeId, orderSpecId, items) => {
  const normalizedItems = normalizeReceivedItems(items);
  const receivedQuantityByProductId = new Map(
    normalizedItems.map((item) => [item.productId, item.receivedQuantity]),
  );

  const result = await sequelize.transaction(async (transaction) => {
    const spec = await OrderSpecification.findOne({
      where: { orderSpecId, storeId },
      include: [{ model: OrderSpecificationItem, as: "items" }],
      transaction,
      lock: true,
    });
    if (!spec) {
      throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
    }
    if (spec.orderStatus === "RECEIVED") {
      throw createHttpError(
        409,
        "ALREADY_RECEIVED",
        "이미 입고 처리가 완료된 발주입니다.",
      );
    }
    assertTransition(spec.orderStatus, "RECEIVED");

    const specItems = spec.items ?? [];
    if (specItems.length === 0) {
      throw createHttpError(
        409,
        "INVALID_SPEC_STATUS",
        "입고 처리할 상품 항목이 없습니다.",
      );
    }

    const missingItem = specItems.find(
      (item) => !receivedQuantityByProductId.has(item.productId),
    );
    if (missingItem) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `입고 수량이 누락되었습니다. (product_id=${missingItem.productId})`,
      );
    }

    const comparison = [];
    for (const item of specItems) {
      const receivedQuantity = receivedQuantityByProductId.get(item.productId);
      if (receivedQuantity > 0) {
        const inventory = await StoreInventory.findOne({
          where: { storeId: spec.storeId, productId: item.productId },
          transaction,
          lock: true,
        });
        if (!inventory) {
          throw createHttpError(
            409,
            "INVENTORY_NOT_FOUND",
            "재고 정보가 없어 입고 처리를 할 수 없습니다.",
          );
        }
        await inventory.increment("currentStock", {
          by: receivedQuantity,
          transaction,
        });
      }

      item.receivedQuantity = receivedQuantity;
      await item.save({ transaction });

      comparison.push({
        product_id: item.productId,
        product_name: item.productName,
        order_quantity: item.orderQuantity,
        received_quantity: receivedQuantity,
        difference: receivedQuantity - item.orderQuantity,
      });
    }

    const { spec: updated } = await applyTransition(spec, "RECEIVED", {
      transaction,
      note: "입고 완료",
      extraFields: { receivedAt: new Date() },
    });

    return { spec: updated, comparison };
  });

  return {
    ...serializeSpec(result.spec, { includeItems: true }),
    comparison: result.comparison,
  };
};

const buildSpecIncludes = ({ includeStore = true } = {}) => [
  ...(includeStore
    ? [{ model: Store, as: "store", attributes: ["storeId", "storeName"] }]
    : []),
  {
    model: OrderSpecificationItem,
    as: "items",
    separate: true,
    order: [["orderSpecItemId", "ASC"]],
  },
  {
    model: OrderStatusHistory,
    as: "statusHistories",
    separate: true,
    order: [["historyId", "ASC"]],
  },
];

const getOrderSpecs = async (storeId, { status, page = 1, limit = 20 } = {}) => {
  const where = { storeId };
  if (status !== undefined) {
    where.orderStatus = status;
  }

  const total = await OrderSpecification.count({ where });
  const specs = await OrderSpecification.findAll({
    where,
    include: buildSpecIncludes(),
    order: [
      ["createdAt", "DESC"],
      ["orderSpecId", "DESC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });

  return { specs, total };
};

const getOrderSpecDetail = async (storeId, orderSpecId) => {
  const spec = await OrderSpecification.findOne({
    where: { orderSpecId, storeId },
    include: buildSpecIncludes(),
  });
  if (!spec) {
    throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
  }
  return serializeSpec(spec, { includeItems: true });
};

const getAdminOrderSpecs = async ({
  storeId,
  status,
  page = 1,
  limit = 20,
} = {}) => {
  const where = {};
  if (storeId !== undefined) {
    where.storeId = storeId;
  }
  if (status !== undefined) {
    where.orderStatus = status;
  }

  const total = await OrderSpecification.count({ where });
  const specs = await OrderSpecification.findAll({
    where,
    include: buildSpecIncludes(),
    order: [
      ["createdAt", "DESC"],
      ["orderSpecId", "DESC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });

  return { specs, total };
};

const getAdminOrderSpecDetail = async (orderSpecId) => {
  const spec = await OrderSpecification.findOne({
    where: { orderSpecId },
    include: buildSpecIncludes(),
  });
  if (!spec) {
    throw createHttpError(404, "NOT_FOUND", "발주 명세서를 찾을 수 없습니다.");
  }
  return serializeSpec(spec, { includeItems: true });
};

module.exports = {
  SPEC_STATUSES,
  SPEC_STATUS_TRANSITIONS,
  buildOrderNumber,
  serializeSpec,
  serializeSpecItem,
  serializeSpecHistory,
  createOrderSpec,
  updateOrderSpecItems,
  submitOrderSpec,
  cancelOrderSpec,
  approveOrderSpec,
  rejectOrderSpec,
  issueOrderSpec,
  receiveOrderSpec,
  getOrderSpecs,
  getOrderSpecDetail,
  getAdminOrderSpecs,
  getAdminOrderSpecDetail,
};
