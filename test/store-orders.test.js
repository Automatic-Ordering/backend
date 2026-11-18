const request = require("supertest");
const { sequelize } = require("../config/database");
const {
  Sales,
  StoreInventory,
  StoreOrderSetting,
  Order,
} = require("../models");
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

const overrideMethod = (target, key, implementation) => {
  const original = target[key];
  target[key] = implementation;
  return () => {
    target[key] = original;
  };
};

// 점포별 자동 발주 기준 설정 목업 (기본값: 120/7/0.4/0.6/1.65/3)
const mockOrderSettings = (overrides = {}) =>
  overrideMethod(StoreOrderSetting, "findOne", async () => ({
    settingId: 1,
    storeId: 1,
    analysisPeriodDays: 120,
    movingAverageDays: 7,
    movingAverageWeight: "0.400",
    sameWeekdayWeight: "0.600",
    serviceFactor: "1.650",
    forecastPeriodDays: 3,
    createdAt: new Date("2026-11-14T00:00:00Z"),
    updatedAt: new Date("2026-11-14T00:00:00Z"),
    ...overrides,
  }));

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
  expect(unauthorized.statusCode).toBe(401);

  setStoreAuthMock();
  const forbidden = await request(app)
    .get("/api/store/orders")
    .set("Authorization", `Bearer ${adminToken()}`);
  expect(forbidden.statusCode).toBe(403);
});

test("returns auto order recommendations with calculated values", async () => {
  setStoreAuthMock();
  const restoreSettings = mockOrderSettings();

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

    expect(response.statusCode).toBe(200);
    expect(response.body.items.length).toBe(2);
    expect(response.body.total).toBe(2);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(20);
    expect(response.body.total_pages).toBe(1);

    const first = response.body.items[0];
    expect(first.product_id).toBe(1);
    expect(first.current_stock).toBe(3);
    expect(first.incoming_quantity).toBe(0);
    expect(first.predicted_demand).toBeCloseTo(4, 9);
    expect(first.lead_time_days).toBe(2);
    expect(first.forecast_period_days).toBe(1);
    expect(first.forecast_coverage_days).toBe(1);
    expect(first.order_unit).toBe(5);
    expect(first.target_stock).toBe(4);
    expect(first.raw_order_quantity).toBe(1);
    expect(first.order_quantity).toBe(5);
    expect(first.needs_order).toBe(true);
    expect(first.applied_safety_stock).toBe(0);
    expect(first.safety_stock_source).toBe("NOT_APPLIED");
    expect(first.data_warning).toEqual([]);

    const second = response.body.items[1];
    expect(second.product_id).toBe(2);
    expect(second.order_quantity).toBe(0);
    expect(second.needs_order).toBe(false);
    expect(second.configured_safety_stock).toBe(5);
    expect(second.applied_safety_stock).toBe(0);
    expect(second.safety_stock_source).toBe("NOT_APPLIED");
    expect(second.data_warning).toEqual(["NO_SALES_DATA"]);

    expect(salesFindAllCalls.length).toBe(1);
    expect(salesFindAllCalls[0].where.storeId).toBe(1);
    const inSymbol = Object.getOwnPropertySymbols(
      salesFindAllCalls[0].where.productId,
    )[0];
    expect(salesFindAllCalls[0].where.productId[inSymbol]).toEqual([1, 2]);
    expect(inventoryFindAllCalls[0].limit).toBe(20);
    expect(inventoryFindAllCalls[0].offset).toBe(0);
    expect(inventoryCountCalls[0].where.storeId).toBe(1);

    const invalidPage = await request(app)
      .get("/api/store/orders/recommendations?page=0")
      .set("Authorization", `Bearer ${storeToken()}`);
    expect(invalidPage.statusCode).toBe(400);
    expect(invalidPage.body.message).toMatch(/page/);
  } finally {
    Sales.findAll = originalSalesFindAll;
    StoreInventory.findAll = originalInventoryFindAll;
    StoreInventory.count = originalInventoryCount;
    sequelize.query = originalQuery;
    restoreSettings();
  }
});

test("incoming quantity aggregates legacy orders and order specifications without double counting", async () => {
  setStoreAuthMock();
  const restoreSettings = mockOrderSettings();

  const salesFindAllCalls = [];
  const originalSalesFindAll = Sales.findAll;
  const originalInventoryFindAll = StoreInventory.findAll;
  const originalInventoryCount = StoreInventory.count;
  const originalQuery = sequelize.query;

  Sales.findAll = async (args) => {
    salesFindAllCalls.push(args);
    return [
      ...Array.from({ length: 7 }, (_, i) => ({
        productId: 1,
        salesQuantity: 2,
        salesDate: new Date(
          `2026-11-${String(2 + i).padStart(2, "0")}T09:00:00`,
        ),
      })),
    ];
  };

  StoreInventory.findAll = async () => [
    {
      storeId: 1,
      productId: 1,
      currentStock: 0,
      safetyStock: 0,
      product: PRODUCT_1,
    },
  ];

  StoreInventory.count = async () => 1;

  const queryCalls = [];
  sequelize.query = async (sql, options) => {
    queryCalls.push({ sql, options });
    return [[{ product_id: 1, incoming_quantity: 17 }]];
  };

  try {
    const response = await request(app)
      .get("/api/store/orders/recommendations?page=1&limit=20")
      .set("Authorization", `Bearer ${storeToken()}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.items[0].incoming_quantity).toBe(17);
    expect(queryCalls.length).toBe(1);

    const { sql, options } = queryCalls[0];
    expect(sql).toMatch(/UNION ALL/);
    expect(sql).toMatch(/FROM orders/);
    expect(sql).toMatch(/order_specification_items/);
    expect(sql).toMatch(/order_specifications/);
    expect(sql.split("FROM orders").length - 1).toBe(1);
    expect(sql.split("order_specification_items").length - 1).toBe(1);
    expect(options.replacements.storeId).toBe(1);
    expect(options.replacements.openOrderStatuses).toEqual([
      "PENDING",
      "ORDERED",
    ]);
    expect(options.replacements.openSpecStatuses).toEqual([
      "REQUESTED",
      "APPROVED",
      "ORDERED",
    ]);
  } finally {
    Sales.findAll = originalSalesFindAll;
    StoreInventory.findAll = originalInventoryFindAll;
    StoreInventory.count = originalInventoryCount;
    sequelize.query = originalQuery;
    restoreSettings();
  }
});

test("recommendations search filters products server-side", async () => {
  setStoreAuthMock();
  const restoreSettings = mockOrderSettings();

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

    expect(response.statusCode).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(1);
    expect(countCalls[0].where.storeId).toBe(1);
    expect(countCalls[0].include).toBeTruthy();
    expect(findAllCalls[0].include[0].where).toBeTruthy();
    expect(findAllCalls[0].include[0].required).toBe(true);
  } finally {
    Sales.findAll = originalSalesFindAll;
    StoreInventory.findAll = originalInventoryFindAll;
    StoreInventory.count = originalInventoryCount;
    sequelize.query = originalQuery;
    restoreSettings();
  }
});

test("recommendation detail validates product id and ownership", async () => {
  setStoreAuthMock();

  const badId = await request(app)
    .get("/api/store/orders/recommendations/abc")
    .set("Authorization", `Bearer ${storeToken()}`);
  expect(badId.statusCode).toBe(400);

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
    expect(notFound.statusCode).toBe(404);
    expect(notFound.body.error).toBe("NOT_FOUND");
  } finally {
    StoreInventory.findAll = originalInventoryFindAll;
    Sales.findAll = originalSalesFindAll;
    sequelize.query = originalQuery;
  }
});

test("recommendation detail includes calculation basis", async () => {
  setStoreAuthMock();
  const restoreSettings = mockOrderSettings();

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

    expect(response.statusCode).toBe(200);
    expect(response.body.calculation_basis.sales_window_days).toBe(120);
    expect(response.body.calculation_basis.sales_series_days).toBe(7);
    expect(response.body.calculation_basis.moving_average_sample_days).toBe(7);
    expect(response.body.calculation_basis.forecast_period_days).toBe(1);
    expect(response.body.calculation_basis.forecast_coverage_days).toBe(1);
    expect(response.body.calculation_basis.same_weekday_sample_count).toBe(0);
    expect(response.body.calculation_basis.recent_daily_sales.length).toBe(7);
    expect(response.body.applied_settings.analysis_period_days).toBe(120);
    // applied_settings는 저장된 설정값(참고용)이므로 계산에 사용되는 1과 달라도 된다.
    expect(response.body.applied_settings.forecast_period_days).toBe(3);
  } finally {
    StoreInventory.findAll = originalInventoryFindAll;
    Sales.findAll = originalSalesFindAll;
    sequelize.query = originalQuery;
    restoreSettings();
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

    expect(response.statusCode).toBe(201);
    expect(response.body.length).toBe(2);
    expect(response.body[0].order_status).toBe("PENDING");
    expect(response.body[0].order_quantity).toBe(10);
    expect(response.body[1].product_id).toBe(2);
    expect(createCalls.length).toBe(2);
    expect(createCalls[0].values).toEqual({
      storeId: 1,
      productId: 1,
      orderQuantity: 10,
      orderStatus: "PENDING",
    });
    expect(createCalls[0].options.transaction).toBeTruthy();
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
    expect(emptyItems.statusCode).toBe(400);

    const zeroQuantity = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, quantity: 0 }] });
    expect(zeroQuantity.statusCode).toBe(400);
    expect(zeroQuantity.body.message).toMatch(/quantity/);

    const negativeQuantity = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 1, quantity: -5 }] });
    expect(negativeQuantity.statusCode).toBe(400);

    const unregistered = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ items: [{ product_id: 999, quantity: 1 }] });
    expect(unregistered.statusCode).toBe(404);

    const duplicate = await request(app)
      .post("/api/store/orders/confirm")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({
        items: [
          { product_id: 1, quantity: 1 },
          { product_id: 1, quantity: 2 },
        ],
      });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.body.message).toMatch(/중복/);
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
    expect(response.statusCode).toBe(200);
    expect(response.body.items.length).toBe(1);
    expect(response.body.items[0].order_id).toBe(1);
    expect(response.body.items[0].product_name).toBe("참치마요 삼각김밥");
    expect(response.body.items[0].order_status).toBe("PENDING");
    expect(response.body.total).toBe(1);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(20);
    expect(response.body.total_pages).toBe(1);
    expect(findAllCalls[0].where.storeId).toBe(1);
    expect(findAllCalls[0].limit).toBe(20);
    expect(findAllCalls[0].offset).toBe(0);
    expect(countCalls[0].where.storeId).toBe(1);

    const filtered = await request(app)
      .get("/api/store/orders?status=ORDERED")
      .set("Authorization", `Bearer ${storeToken()}`);
    expect(filtered.statusCode).toBe(200);
    expect(findAllCalls[1].where.orderStatus).toBe("ORDERED");
    expect(countCalls[1].where.orderStatus).toBe("ORDERED");

    const paged = await request(app)
      .get("/api/store/orders?page=2&limit=1")
      .set("Authorization", `Bearer ${storeToken()}`);
    expect(paged.statusCode).toBe(200);
    expect(findAllCalls[2].limit).toBe(1);
    expect(findAllCalls[2].offset).toBe(1);
    expect(paged.body.page).toBe(2);

    const invalidStatus = await request(app)
      .get("/api/store/orders?status=WRONG")
      .set("Authorization", `Bearer ${storeToken()}`);
    expect(invalidStatus.statusCode).toBe(400);

    const invalidPage = await request(app)
      .get("/api/store/orders?page=0")
      .set("Authorization", `Bearer ${storeToken()}`);
    expect(invalidPage.statusCode).toBe(400);
    expect(invalidPage.body.message).toMatch(/page/);

    const invalidLimit = await request(app)
      .get("/api/store/orders?limit=999")
      .set("Authorization", `Bearer ${storeToken()}`);
    expect(invalidLimit.statusCode).toBe(400);
    expect(invalidLimit.body.message).toMatch(/limit/);
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

    expect(response.statusCode).toBe(404);
    expect(findOneCalls[0].where.storeId).toBe(1);
    expect(findOneCalls[0].where.orderId).toBe(77);
  } finally {
    Order.findOne = originalOrderFindOne;
  }
});
