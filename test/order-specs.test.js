const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const { sequelize } = require("../config/database");
const {
  OrderSpecification,
  OrderSpecificationItem,
  OrderStatusHistory,
  StoreInventory,
  Sales,
} = require("../models");
const {
  app,
  adminToken,
  storeToken,
  setQueryMock,
  setConnectionMock,
  resetTestCaptures,
  getCapturedCommitCount,
  getCapturedRollbackCount,
} = require("./support/test-app");

const STORE_ROW = {
  store_id: 1,
  store_code: "10001",
  store_name: "Store A",
  status: "ACTIVE",
  account_id: 1,
  password_change_required: 0,
};

const setStoreAuthMock = () => {
  setQueryMock(async (sql) => {
    if (sql.includes("FROM stores s")) {
      return [[STORE_ROW]];
    }
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });
};

const setAdminAuthMock = () => {
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
    if (sql.includes("FROM stores s")) {
      return [[STORE_ROW]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });
};

const overrideMethod = (target, key, implementation) => {
  const original = target[key];
  target[key] = implementation;
  return () => {
    target[key] = original;
  };
};

const mockTransaction = () => {
  const original = sequelize.transaction;
  sequelize.transaction = async (callback) => callback({});
  return () => {
    sequelize.transaction = original;
  };
};

const PRODUCT_1 = {
  productId: 1,
  productName: "참치마요 삼각김밥",
  category: "삼각김밥 / 샌드위치",
  price: "1500.00",
  leadTimeDays: 2,
  orderUnit: 5,
};

const PRODUCT_2 = {
  productId: 2,
  productName: "컵라면",
  category: "컵라면 / 봉지라면",
  price: "1200.00",
  leadTimeDays: 1,
  orderUnit: 4,
};

const STORE_INVENTORIES = [
  {
    storeId: 1,
    productId: 1,
    currentStock: 3,
    safetyStock: 0,
    product: PRODUCT_1,
  },
  {
    storeId: 1,
    productId: 2,
    currentStock: 7,
    safetyStock: 5,
    product: PRODUCT_2,
  },
];

const buildSpecInstance = (overrides = {}) => {
  const spec = {
    orderSpecId: 101,
    orderNumber: null,
    storeId: 1,
    orderStatus: "DRAFT",
    requestDate: null,
    totalAmount: 0,
    adminId: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    issuedOrderNumber: null,
    issuedAt: null,
    receivedAt: null,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    store: undefined,
    items: undefined,
    statusHistories: undefined,
    ...overrides,
    updateCalls: [],
    saveCalls: [],
  };
  spec.update = async (values, options) => {
    spec.updateCalls.push({ values, options });
    Object.assign(spec, values);
    return spec;
  };
  spec.save = async (options) => {
    spec.saveCalls.push(options);
    return spec;
  };
  return spec;
};

const buildItemInstance = (overrides = {}) => {
  const item = {
    orderSpecItemId: 1,
    orderSpecId: 101,
    productId: 1,
    productName: "참치마요 삼각김밥",
    orderQuantity: 10,
    unitPrice: "1500.00",
    amount: "15000.00",
    receivedQuantity: null,
    ...overrides,
    saveCalls: [],
  };
  item.save = async (options) => {
    item.saveCalls.push(options);
    return item;
  };
  return item;
};

test("spec endpoints require authentication and proper roles", async () => {
  const unauthorized = await request(app).get("/api/store/orders/specs");
  assert.equal(unauthorized.status, 401);

  setAdminAuthMock();
  const adminOnStoreRoutes = await request(app)
    .get("/api/store/orders/specs")
    .set("Authorization", `Bearer ${adminToken()}`);
  assert.equal(adminOnStoreRoutes.status, 403);

  setStoreAuthMock();
  const storeOnAdminList = await request(app)
    .get("/api/admin/orders/specs")
    .set("Authorization", `Bearer ${storeToken()}`);
  assert.equal(storeOnAdminList.status, 403);

  const storeOnAdminApprove = await request(app)
    .post("/api/admin/orders/specs/101/approve")
    .set("Authorization", `Bearer ${storeToken()}`);
  assert.equal(storeOnAdminApprove.status, 403);
});

test("creates DRAFT specification from submitted items with server-side amounts", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const restoreInventoryFindAll = overrideMethod(
    StoreInventory,
    "findAll",
    async () => STORE_INVENTORIES,
  );

  const specInstance = buildSpecInstance({ orderSpecId: 101 });
  const specCreateCalls = [];
  const restoreSpecCreate = overrideMethod(
    OrderSpecification,
    "create",
    async (values, options) => {
      specCreateCalls.push({ values, options });
      Object.assign(specInstance, values);
      return specInstance;
    },
  );

  const bulkCreateCalls = [];
  const restoreItemBulkCreate = overrideMethod(
    OrderSpecificationItem,
    "bulkCreate",
    async (rows, options) => {
      bulkCreateCalls.push({ rows, options });
      return rows.map((row, index) => ({
        orderSpecItemId: 500 + index,
        ...row,
      }));
    },
  );

  const historyCalls = [];
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values, options) => {
      historyCalls.push({ values, options });
      return { historyId: 900, ...values };
    },
  );

  try {
    const response = await request(app)
      .post("/api/store/orders/specs")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({
        items: [
          { product_id: 1, quantity: 10 },
          { product_id: 2, quantity: 4 },
        ],
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.order_spec_id, 101);
    assert.equal(response.body.order_status, "DRAFT");
    assert.match(response.body.order_number, /^OS-\d{8}-000101$/);
    assert.equal(response.body.total_amount, 19800);
    assert.equal(response.body.items.length, 2);
    assert.equal(response.body.items[0].product_id, 1);
    assert.equal(response.body.items[0].product_name, "참치마요 삼각김밥");
    assert.equal(response.body.items[0].order_quantity, 10);
    assert.equal(response.body.items[0].unit_price, 1500);
    assert.equal(response.body.items[0].amount, 15000);
    assert.equal(response.body.items[1].amount, 4800);
    assert.equal(response.body.status_histories.length, 1);
    assert.equal(response.body.status_histories[0].to_status, "DRAFT");

    assert.deepEqual(specCreateCalls[0].values, {
      storeId: 1,
      orderStatus: "DRAFT",
      totalAmount: 19800,
    });
    assert.ok(specCreateCalls[0].options.transaction);
    assert.ok(bulkCreateCalls[0].options.transaction);
    assert.equal(bulkCreateCalls[0].rows[0].orderQuantity, 10);
    assert.equal(bulkCreateCalls[0].rows[1].unitPrice, 1200);
    assert.equal(historyCalls[0].values.toStatus, "DRAFT");

    const unregistered = await request(app)
      .post("/api/store/orders/specs")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 999, quantity: 1 }] });
    assert.equal(unregistered.status, 404);

    const duplicate = await request(app)
      .post("/api/store/orders/specs")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({
        items: [
          { product_id: 1, quantity: 1 },
          { product_id: 1, quantity: 2 },
        ],
      });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body.message, /중복/);

    const zeroQuantity = await request(app)
      .post("/api/store/orders/specs")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, quantity: 0 }] });
    assert.equal(zeroQuantity.status, 400);
  } finally {
    restoreInventoryFindAll();
    restoreSpecCreate();
    restoreItemBulkCreate();
    restoreHistoryCreate();
    restoreTransaction();
  }
});

test("creates DRAFT specification from auto order recommendations", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const originalQuery = sequelize.query;
  sequelize.query = async () => [[{ product_id: 1, incoming_quantity: 0 }]];
  const restoreSalesFindAll = overrideMethod(Sales, "findAll", async () =>
    Array.from({ length: 7 }, (_, i) => ({
      productId: 1,
      salesQuantity: 4,
      salesDate: new Date(`2026-11-${String(2 + i).padStart(2, "0")}T09:00:00`),
    })),
  );
  const restoreInventoryFindAll = overrideMethod(
    StoreInventory,
    "findAll",
    async () => STORE_INVENTORIES,
  );
  const restoreInventoryCount = overrideMethod(
    StoreInventory,
    "count",
    async () => 2,
  );

  const specInstance = buildSpecInstance({ orderSpecId: 102 });
  const restoreSpecCreate = overrideMethod(
    OrderSpecification,
    "create",
    async (values, options) => {
      Object.assign(specInstance, values);
      return specInstance;
    },
  );
  const restoreItemBulkCreate = overrideMethod(
    OrderSpecificationItem,
    "bulkCreate",
    async (rows) => rows.map((row, index) => ({ orderSpecItemId: 600 + index, ...row })),
  );
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values) => ({ historyId: 901, ...values }),
  );

  try {
    const response = await request(app)
      .post("/api/store/orders/specs")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({});

    assert.equal(response.status, 201);
    assert.equal(response.body.order_status, "DRAFT");
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].product_id, 1);
    assert.equal(response.body.items[0].order_quantity, 5);
    assert.equal(response.body.items[0].amount, 7500);
    assert.equal(response.body.total_amount, 7500);

    const restoreInventoryCount2 = overrideMethod(
      StoreInventory,
      "count",
      async () => 0,
    );
    try {
      const empty = await request(app)
        .post("/api/store/orders/specs")
        .set("Authorization", `Bearer ${storeToken()}`)
        .send({});
      assert.equal(empty.status, 400);
      assert.match(empty.body.message, /발주 대상 상품이 없/);
    } finally {
      restoreInventoryCount2();
    }
  } finally {
    sequelize.query = originalQuery;
    restoreSalesFindAll();
    restoreInventoryFindAll();
    restoreInventoryCount();
    restoreSpecCreate();
    restoreItemBulkCreate();
    restoreHistoryCreate();
    restoreTransaction();
  }
});

test("items are editable only while DRAFT", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const restoreInventoryFindAll = overrideMethod(
    StoreInventory,
    "findAll",
    async () => STORE_INVENTORIES,
  );

  const draftSpec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "DRAFT",
    totalAmount: 19800,
  });
  const destroyCalls = [];
  const bulkCreateCalls = [];

  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async (args) => {
      assert.equal(args.where.orderSpecId, 101);
      assert.equal(args.where.storeId, 1);
      return draftSpec;
    },
  );
  const restoreItemDestroy = overrideMethod(
    OrderSpecificationItem,
    "destroy",
    async (args) => {
      destroyCalls.push(args);
      return 2;
    },
  );
  const restoreItemBulkCreate = overrideMethod(
    OrderSpecificationItem,
    "bulkCreate",
    async (rows, options) => {
      bulkCreateCalls.push({ rows, options });
      return rows.map((row, index) => ({ orderSpecItemId: 700 + index, ...row }));
    },
  );

  try {
    const response = await request(app)
      .patch("/api/store/orders/specs/101/items")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, quantity: 7 }] });

    assert.equal(response.status, 200);
    assert.equal(destroyCalls.length, 1);
    assert.equal(bulkCreateCalls[0].rows[0].orderQuantity, 7);
    assert.equal(response.body.total_amount, 10500);
    assert.equal(response.body.item_count, 1);

    const requestedSpec = buildSpecInstance({
      orderSpecId: 101,
      orderStatus: "REQUESTED",
    });
    const restoreSpecFindOne2 = overrideMethod(
      OrderSpecification,
      "findOne",
      async () => requestedSpec,
    );
    try {
      const blocked = await request(app)
        .patch("/api/store/orders/specs/101/items")
        .set("Authorization", `Bearer ${storeToken()}`)
        .send({ items: [{ product_id: 1, quantity: 7 }] });

      assert.equal(blocked.status, 409);
      assert.equal(blocked.body.error, "SPEC_NOT_EDITABLE");
      assert.match(blocked.body.message, /제출된 발주 명세서/);
    } finally {
      restoreSpecFindOne2();
    }
  } finally {
    restoreInventoryFindAll();
    restoreSpecFindOne();
    restoreItemDestroy();
    restoreItemBulkCreate();
    restoreTransaction();
  }
});

test("submit moves DRAFT to REQUESTED and records request date", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const spec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "DRAFT",
    items: [buildItemInstance({ orderSpecItemId: 1 })],
  });
  const historyCalls = [];
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => spec,
  );
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values, options) => {
      historyCalls.push({ values, options });
      return { historyId: 910, ...values };
    },
  );

  try {
    const response = await request(app)
      .post("/api/store/orders/specs/101/submit")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, "REQUESTED");
    assert.ok(response.body.request_date);
    assert.equal(spec.updateCalls[0].values.orderStatus, "REQUESTED");
    assert.ok(spec.updateCalls[0].values.requestDate instanceof Date);
    assert.equal(historyCalls[0].values.fromStatus, "DRAFT");
    assert.equal(historyCalls[0].values.toStatus, "REQUESTED");
    assert.ok(historyCalls[0].options.transaction);

    const emptySpec = buildSpecInstance({
      orderSpecId: 102,
      orderStatus: "DRAFT",
      items: [],
    });
    const restoreSpecFindOne2 = overrideMethod(
      OrderSpecification,
      "findOne",
      async () => emptySpec,
    );
    try {
      const emptyItems = await request(app)
        .post("/api/store/orders/specs/102/submit")
        .set("Authorization", `Bearer ${storeToken()}`);
      assert.equal(emptyItems.status, 400);
    } finally {
      restoreSpecFindOne2();
    }

    const requestedSpec = buildSpecInstance({
      orderSpecId: 103,
      orderStatus: "REQUESTED",
      items: [buildItemInstance({ orderSpecItemId: 1 })],
    });
    const restoreSpecFindOne3 = overrideMethod(
      OrderSpecification,
      "findOne",
      async () => requestedSpec,
    );
    try {
      const duplicateSubmit = await request(app)
        .post("/api/store/orders/specs/103/submit")
        .set("Authorization", `Bearer ${storeToken()}`);
      assert.equal(duplicateSubmit.status, 409);
      assert.equal(duplicateSubmit.body.error, "INVALID_SPEC_STATUS");
    } finally {
      restoreSpecFindOne3();
    }
  } finally {
    restoreSpecFindOne();
    restoreHistoryCreate();
    restoreTransaction();
  }
});

test("admin approves REQUESTED specification and records approver", async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const spec = buildSpecInstance({ orderSpecId: 101, orderStatus: "REQUESTED" });
  const findOneCalls = [];
  const historyCalls = [];
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async (args) => {
      findOneCalls.push(args);
      return spec;
    },
  );
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values) => {
      historyCalls.push(values);
      return { historyId: 920, ...values };
    },
  );

  try {
    const response = await request(app)
      .post("/api/admin/orders/specs/101/approve")
      .set("Authorization", `Bearer ${adminToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, "APPROVED");
    assert.equal(response.body.admin_id, 1);
    assert.ok(response.body.approved_at);
    assert.equal(findOneCalls[0].where.orderSpecId, 101);
    assert.equal(findOneCalls[0].where.storeId, undefined);
    assert.equal(historyCalls[0].toStatus, "APPROVED");
    assert.equal(historyCalls[0].changedByAdminId, 1);

    const approvedSpec = buildSpecInstance({
      orderSpecId: 101,
      orderStatus: "APPROVED",
    });
    const restoreSpecFindOne2 = overrideMethod(
      OrderSpecification,
      "findOne",
      async () => approvedSpec,
    );
    try {
      const duplicateApprove = await request(app)
        .post("/api/admin/orders/specs/101/approve")
        .set("Authorization", `Bearer ${adminToken()}`);
      assert.equal(duplicateApprove.status, 409);
      assert.equal(duplicateApprove.body.error, "INVALID_SPEC_STATUS");
    } finally {
      restoreSpecFindOne2();
    }
  } finally {
    restoreSpecFindOne();
    restoreHistoryCreate();
    restoreTransaction();
  }
});

test("admin rejects specification with mandatory reason", async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const spec = buildSpecInstance({ orderSpecId: 101, orderStatus: "REQUESTED" });
  const historyCalls = [];
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => spec,
  );
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values) => {
      historyCalls.push(values);
      return { historyId: 930, ...values };
    },
  );

  try {
    const response = await request(app)
      .post("/api/admin/orders/specs/101/reject")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ reason: "발주 수량이 과다합니다." });

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, "REJECTED");
    assert.equal(response.body.admin_id, 1);
    assert.equal(response.body.rejection_reason, "발주 수량이 과다합니다.");
    assert.ok(response.body.rejected_at);
    assert.equal(historyCalls[0].toStatus, "REJECTED");
    assert.equal(historyCalls[0].changedByAdminId, 1);
    assert.match(historyCalls[0].note, /발주 수량이 과다합니다/);

    const missingReason = await request(app)
      .post("/api/admin/orders/specs/101/reject")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({});
    assert.equal(missingReason.status, 400);

    const blankReason = await request(app)
      .post("/api/admin/orders/specs/101/reject")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ reason: "   " });
    assert.equal(blankReason.status, 400);
  } finally {
    restoreSpecFindOne();
    restoreHistoryCreate();
    restoreTransaction();
  }
});

test("admin issues order sheet for approved specification", async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const spec = buildSpecInstance({ orderSpecId: 101, orderStatus: "APPROVED" });
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => spec,
  );
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values) => ({ historyId: 940, ...values }),
  );

  try {
    const response = await request(app)
      .post("/api/admin/orders/specs/101/issue")
      .set("Authorization", `Bearer ${adminToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, "ORDERED");
    assert.match(response.body.issued_order_number, /^PO-\d{8}-000101$/);
    assert.ok(response.body.issued_at);

    const requestedSpec = buildSpecInstance({
      orderSpecId: 101,
      orderStatus: "REQUESTED",
    });
    const restoreSpecFindOne2 = overrideMethod(
      OrderSpecification,
      "findOne",
      async () => requestedSpec,
    );
    try {
      const notApproved = await request(app)
        .post("/api/admin/orders/specs/101/issue")
        .set("Authorization", `Bearer ${adminToken()}`);
      assert.equal(notApproved.status, 409);
      assert.equal(notApproved.body.error, "INVALID_SPEC_STATUS");
    } finally {
      restoreSpecFindOne2();
    }
  } finally {
    restoreSpecFindOne();
    restoreHistoryCreate();
    restoreTransaction();
  }
});

test("admin lists specifications with filters and pagination", async () => {
  setAdminAuthMock();

  const findAllCalls = [];
  const countCalls = [];
  const spec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "REQUESTED",
    store: { storeId: 2, storeName: "Store B" },
    items: [buildItemInstance({ orderSpecItemId: 1 })],
  });
  const restoreSpecFindAll = overrideMethod(
    OrderSpecification,
    "findAll",
    async (args) => {
      findAllCalls.push(args);
      return [spec];
    },
  );
  const restoreSpecCount = overrideMethod(
    OrderSpecification,
    "count",
    async (args) => {
      countCalls.push(args);
      return 1;
    },
  );

  try {
    const response = await request(app)
      .get("/api/admin/orders/specs?store_id=2&status=REQUESTED&page=1&limit=10")
      .set("Authorization", `Bearer ${adminToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 1);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].store_name, "Store B");
    assert.equal(response.body.items[0].item_count, 1);
    assert.equal(findAllCalls[0].where.storeId, 2);
    assert.equal(findAllCalls[0].where.orderStatus, "REQUESTED");
    assert.equal(findAllCalls[0].limit, 10);
    assert.equal(countCalls[0].where.storeId, 2);

    const invalidStatus = await request(app)
      .get("/api/admin/orders/specs?status=NOPE")
      .set("Authorization", `Bearer ${adminToken()}`);
    assert.equal(invalidStatus.status, 400);

    const invalidStore = await request(app)
      .get("/api/admin/orders/specs?store_id=abc")
      .set("Authorization", `Bearer ${adminToken()}`);
    assert.equal(invalidStore.status, 400);
  } finally {
    restoreSpecFindAll();
    restoreSpecCount();
  }
});

test("store list is scoped and detail blocks other stores", async () => {
  setStoreAuthMock();

  const findAllCalls = [];
  const countCalls = [];
  const spec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "REQUESTED",
    store: { storeId: 1, storeName: "Store A" },
    items: [buildItemInstance({ orderSpecItemId: 1 })],
  });
  const restoreSpecFindAll = overrideMethod(
    OrderSpecification,
    "findAll",
    async (args) => {
      findAllCalls.push(args);
      return [spec];
    },
  );
  const restoreSpecCount = overrideMethod(
    OrderSpecification,
    "count",
    async (args) => {
      countCalls.push(args);
      return 1;
    },
  );

  try {
    const response = await request(app)
      .get("/api/store/orders/specs")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(findAllCalls[0].where.storeId, 1);
    assert.equal(response.body.items[0].store_id, 1);

    const pendingReceipts = await request(app)
      .get("/api/store/orders/specs/pending-receipts")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(pendingReceipts.status, 200);
    assert.equal(findAllCalls[1].where.orderStatus, "ORDERED");
    assert.equal(findAllCalls[1].where.storeId, 1);

    const invalidStatus = await request(app)
      .get("/api/store/orders/specs?status=WRONG")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(invalidStatus.status, 400);
  } finally {
    restoreSpecFindAll();
    restoreSpecCount();
  }

  const findOneCalls = [];
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async (args) => {
      findOneCalls.push(args);
      return null;
    },
  );
  try {
    const otherStoreSpec = await request(app)
      .get("/api/store/orders/specs/999")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(otherStoreSpec.status, 404);
    assert.equal(findOneCalls[0].where.storeId, 1);
    assert.equal(findOneCalls[0].where.orderSpecId, 999);
  } finally {
    restoreSpecFindOne();
  }
});

test("receipt completes order and increases store inventory", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const item1 = buildItemInstance({
    orderSpecItemId: 1,
    productId: 1,
    orderQuantity: 10,
  });
  const item2 = buildItemInstance({
    orderSpecItemId: 2,
    productId: 2,
    productName: "컵라면",
    orderQuantity: 4,
    unitPrice: "1200.00",
    amount: "4800.00",
  });
  const spec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "ORDERED",
    items: [item1, item2],
  });

  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async (args) => {
      assert.equal(args.where.orderSpecId, 101);
      assert.equal(args.where.storeId, 1);
      return spec;
    },
  );

  const incrementCalls = [];
  const restoreInventoryFindOne = overrideMethod(
    StoreInventory,
    "findOne",
    async (args) => ({
      currentStock: 3,
      increment: async (field, options) => {
        incrementCalls.push({ where: args.where, field, options });
      },
    }),
  );

  const historyCalls = [];
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values) => {
      historyCalls.push(values);
      return { historyId: 950, ...values };
    },
  );

  try {
    const response = await request(app)
      .post("/api/store/orders/specs/101/receipt")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({
        items: [
          { product_id: 1, received_quantity: 8 },
          { product_id: 2, received_quantity: 4 },
        ],
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, "RECEIVED");
    assert.ok(response.body.received_at);
    assert.equal(response.body.comparison.length, 2);
    assert.equal(response.body.comparison[0].order_quantity, 10);
    assert.equal(response.body.comparison[0].received_quantity, 8);
    assert.equal(response.body.comparison[0].difference, -2);
    assert.equal(response.body.comparison[1].difference, 0);
    assert.equal(response.body.items[0].received_quantity, 8);

    assert.equal(incrementCalls.length, 2);
    assert.equal(incrementCalls[0].field, "currentStock");
    assert.equal(incrementCalls[0].options.by, 8);
    assert.deepEqual(incrementCalls[0].where, { storeId: 1, productId: 1 });
    assert.equal(incrementCalls[1].options.by, 4);
    assert.equal(item1.saveCalls.length, 1);
    assert.equal(item1.receivedQuantity, 8);
    assert.equal(historyCalls[0].toStatus, "RECEIVED");
    assert.equal(historyCalls[0].changedByAdminId, null);
  } finally {
    restoreSpecFindOne();
    restoreInventoryFindOne();
    restoreHistoryCreate();
    restoreTransaction();
  }
});

test("duplicate receipt and invalid receipt inputs are blocked", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const receivedSpec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "RECEIVED",
    items: [buildItemInstance({ orderSpecItemId: 1, productId: 1 })],
  });
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => receivedSpec,
  );

  try {
    const duplicate = await request(app)
      .post("/api/store/orders/specs/101/receipt")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, received_quantity: 5 }] });

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error, "ALREADY_RECEIVED");
  } finally {
    restoreSpecFindOne();
  }

  const orderedSpec = buildSpecInstance({
    orderSpecId: 102,
    orderStatus: "ORDERED",
    items: [
      buildItemInstance({ orderSpecItemId: 1, productId: 1 }),
      buildItemInstance({
        orderSpecItemId: 2,
        productId: 2,
        productName: "컵라면",
        orderQuantity: 4,
      }),
    ],
  });
  const restoreSpecFindOne2 = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => orderedSpec,
  );

  try {
    const missingItem = await request(app)
      .post("/api/store/orders/specs/102/receipt")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, received_quantity: 5 }] });
    assert.equal(missingItem.status, 400);
    assert.match(missingItem.body.message, /누락/);

    const negativeQuantity = await request(app)
      .post("/api/store/orders/specs/102/receipt")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, received_quantity: -1 }] });
    assert.equal(negativeQuantity.status, 400);

    const notOrderedSpec = buildSpecInstance({
      orderSpecId: 103,
      orderStatus: "APPROVED",
      items: [buildItemInstance({ orderSpecItemId: 1, productId: 1 })],
    });
    const restoreSpecFindOne3 = overrideMethod(
      OrderSpecification,
      "findOne",
      async () => notOrderedSpec,
    );
    try {
      const wrongStatus = await request(app)
        .post("/api/store/orders/specs/103/receipt")
        .set("Authorization", `Bearer ${storeToken()}`)
        .send({ items: [{ product_id: 1, received_quantity: 5 }] });
      assert.equal(wrongStatus.status, 409);
      assert.equal(wrongStatus.body.error, "INVALID_SPEC_STATUS");
    } finally {
      restoreSpecFindOne3();
    }
  } finally {
    restoreSpecFindOne2();
    restoreTransaction();
  }
});

test("receipt failure rolls back the transaction", async () => {
  setStoreAuthMock();
  resetTestCaptures();

  const connection = {
    commit: async () => {},
    rollback: async () => {},
  };
  const originalTransaction = sequelize.transaction;
  setConnectionMock(connection);

  const spec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "ORDERED",
    items: [buildItemInstance({ orderSpecItemId: 1, productId: 1 })],
  });
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => spec,
  );
  const restoreInventoryFindOne = overrideMethod(
    StoreInventory,
    "findOne",
    async () => ({
      currentStock: 3,
      increment: async () => {
        throw new Error("forced inventory failure");
      },
    }),
  );

  try {
    const response = await request(app)
      .post("/api/store/orders/specs/101/receipt")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, received_quantity: 8 }] });

    assert.equal(response.status, 500);
    assert.equal(getCapturedRollbackCount(), 1);
    assert.equal(getCapturedCommitCount(), 0);
    assert.equal(spec.saveCalls.length, 0);
    assert.equal(spec.orderStatus, "ORDERED");
    assert.equal(spec.receivedAt, null);
  } finally {
    restoreSpecFindOne();
    restoreInventoryFindOne();
    sequelize.transaction = originalTransaction;
  }
});

test("store cannot cancel approved specification", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const approvedSpec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "APPROVED",
  });
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => approvedSpec,
  );

  try {
    const response = await request(app)
      .post("/api/store/orders/specs/101/cancel")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 409);
    assert.equal(response.body.error, "INVALID_SPEC_STATUS");
    assert.equal(approvedSpec.updateCalls.length, 0);
  } finally {
    restoreSpecFindOne();
    restoreTransaction();
  }
});

test("store can cancel draft specification", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const draftSpec = buildSpecInstance({
    orderSpecId: 101,
    orderStatus: "DRAFT",
  });
  const restoreSpecFindOne = overrideMethod(
    OrderSpecification,
    "findOne",
    async () => draftSpec,
  );
  const restoreHistoryCreate = overrideMethod(
    OrderStatusHistory,
    "create",
    async (values) => ({ historyId: 960, ...values }),
  );

  try {
    const response = await request(app)
      .post("/api/store/orders/specs/101/cancel")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, "CANCELLED");
    assert.equal(draftSpec.updateCalls[0].values.orderStatus, "CANCELLED");
  } finally {
    restoreSpecFindOne();
    restoreHistoryCreate();
    restoreTransaction();
  }
});
