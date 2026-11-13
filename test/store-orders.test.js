const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const { sequelize } = require("../config/database");
const { Sales, StoreInventory, Order } = require("../models");
const {
  app,
  adminToken,
  storeToken,
  setQueryMock,
} = require("./support/test-app");

const setStoreAuthMock = () => {
  setQueryMock(async (sql) => {
    if (sql.includes("FROM stores s")) {
      return [
        [
          {
            store_id: 1,
            store_code: "10001",
            store_name: "Store A",
            status: "ACTIVE",
            account_id: 1,
            password_change_required: 0,
          },
        ],
      ];
    }
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });
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

test("store orders endpoints require store authentication", async () => {
  const unauthorized = await request(app).get(
    "/api/store/orders/recommendations",
  );
  assert.equal(unauthorized.status, 401);

  setStoreAuthMock();
  const forbidden = await request(app)
    .get("/api/store/orders")
    .set("Authorization", `Bearer ${adminToken()}`);
  assert.equal(forbidden.status, 403);
});

test("returns auto order recommendations with calculated values", async () => {
  setStoreAuthMock();

  const salesFindAllCalls = [];
  const inventoryFindAllCalls = [];
  const inventoryCountCalls = [];
  const originalSalesFindAll = Sales.findAll;
  const originalInventoryFindAll = StoreInventory.findAll;
  const originalInventoryCount = StoreInventory.count;
  const originalQuery = sequelize.query;

  Sales.findAll = async (args) => {
    salesFindAllCalls.push(args);
    return [
      ...Array.from({ length: 7 }, (_, i) => ({
        productId: 1,
        salesQuantity: 4,
        salesDate: new Date(
          `2026-11-${String(2 + i).padStart(2, "0")}T09:00:00`,
        ),
      })),
    ];
  };

  StoreInventory.findAll = async (args) => {
    inventoryFindAllCalls.push(args);
    return [
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
  };

  StoreInventory.count = async (args) => {
    inventoryCountCalls.push(args);
    return 2;
  };

  sequelize.query = async () => [[{ product_id: 1, incoming_quantity: 0 }]];

  try {
    const response = await request(app)
      .get("/api/store/orders/recommendations?page=1&limit=20")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 2);
    assert.equal(response.body.total, 2);
    assert.equal(response.body.page, 1);
    assert.equal(response.body.limit, 20);
    assert.equal(response.body.total_pages, 1);

    const first = response.body.items[0];
    assert.equal(first.product_id, 1);
    assert.equal(first.current_stock, 3);
    assert.equal(first.incoming_quantity, 0);
    assert.ok(Math.abs(first.predicted_demand - 4) < 1e-9);
    assert.equal(first.lead_time_days, 2);
    assert.equal(first.order_unit, 5);
    assert.equal(first.target_stock, 8);
    assert.equal(first.order_quantity, 5);
    assert.equal(first.needs_order, true);
    assert.deepEqual(first.data_warning, []);

    const second = response.body.items[1];
    assert.equal(second.product_id, 2);
    assert.equal(second.order_quantity, 0);
    assert.equal(second.needs_order, false);
    assert.equal(second.applied_safety_stock, 5);
    assert.equal(second.safety_stock_source, "CONFIGURED");
    assert.deepEqual(second.data_warning, ["NO_SALES_DATA"]);

    assert.equal(salesFindAllCalls.length, 1);
    assert.equal(salesFindAllCalls[0].where.storeId, 1);
    const inSymbol = Object.getOwnPropertySymbols(
      salesFindAllCalls[0].where.productId,
    )[0];
    assert.deepEqual(salesFindAllCalls[0].where.productId[inSymbol], [1, 2]);
    assert.equal(inventoryFindAllCalls[0].limit, 20);
    assert.equal(inventoryFindAllCalls[0].offset, 0);
    assert.equal(inventoryCountCalls[0].where.storeId, 1);

    const invalidPage = await request(app)
      .get("/api/store/orders/recommendations?page=0")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(invalidPage.status, 400);
    assert.match(invalidPage.body.message, /page/);
  } finally {
    Sales.findAll = originalSalesFindAll;
    StoreInventory.findAll = originalInventoryFindAll;
    StoreInventory.count = originalInventoryCount;
    sequelize.query = originalQuery;
  }
});

test("recommendations search filters products server-side", async () => {
  setStoreAuthMock();

  const findAllCalls = [];
  const countCalls = [];
  const originalSalesFindAll = Sales.findAll;
  const originalInventoryFindAll = StoreInventory.findAll;
  const originalInventoryCount = StoreInventory.count;
  const originalQuery = sequelize.query;

  Sales.findAll = async () => [];
  StoreInventory.findAll = async (args) => {
    findAllCalls.push(args);
    return [];
  };
  StoreInventory.count = async (args) => {
    countCalls.push(args);
    return 1;
  };
  sequelize.query = async () => [[]];

  try {
    const response = await request(app)
      .get("/api/store/orders/recommendations?search=도시락&page=1&limit=20")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.items, []);
    assert.equal(response.body.total, 1);
    assert.equal(countCalls[0].where.storeId, 1);
    assert.ok(countCalls[0].include);
    assert.ok(findAllCalls[0].include[0].where);
    assert.equal(findAllCalls[0].include[0].required, true);
  } finally {
    Sales.findAll = originalSalesFindAll;
    StoreInventory.findAll = originalInventoryFindAll;
    StoreInventory.count = originalInventoryCount;
    sequelize.query = originalQuery;
  }
});

test("recommendation detail validates product id and ownership", async () => {
  setStoreAuthMock();

  const badId = await request(app)
    .get("/api/store/orders/recommendations/abc")
    .set("Authorization", `Bearer ${storeToken()}`);
  assert.equal(badId.status, 400);

  const originalInventoryFindAll = StoreInventory.findAll;
  const originalSalesFindAll = Sales.findAll;
  const originalQuery = sequelize.query;

  StoreInventory.findAll = async () => [];
  Sales.findAll = async () => [];
  sequelize.query = async () => [[]];

  try {
    const notFound = await request(app)
      .get("/api/store/orders/recommendations/999")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.error, "NOT_FOUND");
  } finally {
    StoreInventory.findAll = originalInventoryFindAll;
    Sales.findAll = originalSalesFindAll;
    sequelize.query = originalQuery;
  }
});

test("recommendation detail includes calculation basis", async () => {
  setStoreAuthMock();

  const originalInventoryFindAll = StoreInventory.findAll;
  const originalSalesFindAll = Sales.findAll;
  const originalQuery = sequelize.query;

  StoreInventory.findAll = async () => [
    {
      storeId: 1,
      productId: 1,
      currentStock: 3,
      safetyStock: 0,
      product: PRODUCT_1,
    },
  ];
  Sales.findAll = async () => [
    ...Array.from({ length: 7 }, (_, i) => ({
      productId: 1,
      salesQuantity: 4,
      salesDate: new Date(`2026-11-${String(2 + i).padStart(2, "0")}T09:00:00`),
    })),
  ];
  sequelize.query = async () => [[]];

  try {
    const response = await request(app)
      .get("/api/store/orders/recommendations/1")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.calculation_basis.sales_series_days, 7);
    assert.equal(response.body.calculation_basis.moving_average_sample_days, 7);
    assert.equal(response.body.calculation_basis.same_weekday_sample_count, 1);
    assert.equal(response.body.calculation_basis.recent_daily_sales.length, 7);
  } finally {
    StoreInventory.findAll = originalInventoryFindAll;
    Sales.findAll = originalSalesFindAll;
    sequelize.query = originalQuery;
  }
});

test("confirm creates PENDING orders for registered products", async () => {
  setStoreAuthMock();
  const restoreTransaction = mockTransaction();

  const createCalls = [];
  const originalInventoryFindAll = StoreInventory.findAll;
  const originalOrderCreate = Order.create;

  StoreInventory.findAll = async () => [
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

  Order.create = async (values, options) => {
    createCalls.push({ values, options });
    return {
      orderId: createCalls.length,
      ...values,
      createdAt: "2026-11-13T00:00:00.000Z",
      updatedAt: "2026-11-13T00:00:00.000Z",
    };
  };

  try {
    const response = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({
        items: [
          { product_id: 1, quantity: 10 },
          { product_id: 2, quantity: 4 },
        ],
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.length, 2);
    assert.equal(response.body[0].order_status, "PENDING");
    assert.equal(response.body[0].order_quantity, 10);
    assert.equal(response.body[1].product_id, 2);
    assert.equal(createCalls.length, 2);
    assert.deepEqual(createCalls[0].values, {
      storeId: 1,
      productId: 1,
      orderQuantity: 10,
      orderStatus: "PENDING",
    });
    assert.ok(createCalls[0].options.transaction);
  } finally {
    StoreInventory.findAll = originalInventoryFindAll;
    Order.create = originalOrderCreate;
    restoreTransaction();
  }
});

test("confirm rejects invalid quantities and unregistered products", async () => {
  setStoreAuthMock();

  const originalInventoryFindAll = StoreInventory.findAll;
  const originalOrderCreate = Order.create;
  StoreInventory.findAll = async () => [
    {
      storeId: 1,
      productId: 1,
      currentStock: 3,
      safetyStock: 0,
      product: PRODUCT_1,
    },
  ];
  Order.create = async () => {
    throw new Error("should not create orders");
  };

  try {
    const emptyItems = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [] });
    assert.equal(emptyItems.status, 400);

    const zeroQuantity = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, quantity: 0 }] });
    assert.equal(zeroQuantity.status, 400);
    assert.match(zeroQuantity.body.message, /quantity/);

    const negativeQuantity = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, quantity: -5 }] });
    assert.equal(negativeQuantity.status, 400);

    const unregistered = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 999, quantity: 1 }] });
    assert.equal(unregistered.status, 404);

    const duplicate = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({
        items: [
          { product_id: 1, quantity: 1 },
          { product_id: 1, quantity: 2 },
        ],
      });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body.message, /중복/);
  } finally {
    StoreInventory.findAll = originalInventoryFindAll;
    Order.create = originalOrderCreate;
  }
});

test("order history is paginated and scoped to the authenticated store", async () => {
  setStoreAuthMock();

  const findAllCalls = [];
  const countCalls = [];
  const originalOrderFindAll = Order.findAll;
  const originalOrderCount = Order.count;
  Order.findAll = async (args) => {
    findAllCalls.push(args);
    return [
      {
        orderId: 1,
        storeId: 1,
        productId: 1,
        orderQuantity: 10,
        orderStatus: "PENDING",
        createdAt: "2026-11-13T00:00:00.000Z",
        updatedAt: "2026-11-13T00:00:00.000Z",
        product: PRODUCT_1,
      },
    ];
  };
  Order.count = async (args) => {
    countCalls.push(args);
    return 1;
  };

  try {
    const response = await request(app)
      .get("/api/store/orders")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].order_id, 1);
    assert.equal(response.body.items[0].product_name, "참치마요 삼각김밥");
    assert.equal(response.body.items[0].order_status, "PENDING");
    assert.equal(response.body.total, 1);
    assert.equal(response.body.page, 1);
    assert.equal(response.body.limit, 20);
    assert.equal(response.body.total_pages, 1);
    assert.equal(findAllCalls[0].where.storeId, 1);
    assert.equal(findAllCalls[0].limit, 20);
    assert.equal(findAllCalls[0].offset, 0);
    assert.equal(countCalls[0].where.storeId, 1);

    const filtered = await request(app)
      .get("/api/store/orders?status=ORDERED")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(filtered.status, 200);
    assert.equal(findAllCalls[1].where.orderStatus, "ORDERED");
    assert.equal(countCalls[1].where.orderStatus, "ORDERED");

    const paged = await request(app)
      .get("/api/store/orders?page=2&limit=1")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(paged.status, 200);
    assert.equal(findAllCalls[2].limit, 1);
    assert.equal(findAllCalls[2].offset, 1);
    assert.equal(paged.body.page, 2);

    const invalidStatus = await request(app)
      .get("/api/store/orders?status=WRONG")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(invalidStatus.status, 400);

    const invalidPage = await request(app)
      .get("/api/store/orders?page=0")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(invalidPage.status, 400);
    assert.match(invalidPage.body.message, /page/);

    const invalidLimit = await request(app)
      .get("/api/store/orders?limit=999")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(invalidLimit.status, 400);
    assert.match(invalidLimit.body.message, /limit/);
  } finally {
    Order.findAll = originalOrderFindAll;
    Order.count = originalOrderCount;
  }
});

test("order detail blocks access to other stores orders", async () => {
  setStoreAuthMock();

  const findOneCalls = [];
  const originalOrderFindOne = Order.findOne;
  Order.findOne = async (args) => {
    findOneCalls.push(args);
    return null;
  };

  try {
    const response = await request(app)
      .get("/api/store/orders/77")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 404);
    assert.equal(findOneCalls[0].where.storeId, 1);
    assert.equal(findOneCalls[0].where.orderId, 77);
  } finally {
    Order.findOne = originalOrderFindOne;
  }
});
