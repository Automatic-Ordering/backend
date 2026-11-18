const request = require("supertest");
const { sequelize } = require("../config/database");
const { StoreInventory, Order } = require("../models");
const {
  app,
  adminToken,
  storeToken,
  setQueryMock,
} = require("./support/test-app");

const setAdminAuthMock = () => {
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
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

const buildOrderInstance = ({
  orderStatus,
  orderQuantity = 10,
  storeId = 1,
  productId = 1,
}) => {
  const saveCalls = [];
  return {
    instance: {
      orderId: 5,
      storeId,
      productId,
      orderQuantity,
      orderStatus,
      product: { productId, productName: "참치마요 삼각김밥" },
      save: async (options) => {
        saveCalls.push(options);
        return undefined;
      },
    },
    saveCalls,
  };
};

test("admin order endpoints require admin authentication", async () => {
  const unauthorized = await request(app).get("/api/admin/orders");
  expect(unauthorized.statusCode).toBe(401);

  setAdminAuthMock();
  const forbidden = await request(app)
    .get("/api/admin/orders")
    .set("Authorization", `Bearer ${storeToken()}`);
  expect(forbidden.statusCode).toBe(403);
});

test("admin can list orders with filters", async () => {
  setAdminAuthMock();

  const findAllCalls = [];
  const originalOrderFindAll = Order.findAll;
  Order.findAll = async (args) => {
    findAllCalls.push(args);
    return [];
  };

  try {
    const response = await request(app)
      .get("/api/admin/orders?store_id=2&status=PENDING")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(response.statusCode).toBe(200);
    expect(findAllCalls[0].where.storeId).toBe(2);
    expect(findAllCalls[0].where.orderStatus).toBe("PENDING");

    const invalidStore = await request(app)
      .get("/api/admin/orders?store_id=abc")
      .set("Authorization", `Bearer ${adminToken()}`);
    expect(invalidStore.statusCode).toBe(400);

    const invalidStatus = await request(app)
      .get("/api/admin/orders?status=NOPE")
      .set("Authorization", `Bearer ${adminToken()}`);
    expect(invalidStatus.statusCode).toBe(400);
  } finally {
    Order.findAll = originalOrderFindAll;
  }
});

test("PENDING order can transition to ORDERED without stock change", async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const { instance, saveCalls } = buildOrderInstance({
    orderStatus: "PENDING",
  });
  const originalOrderFindOne = Order.findOne;
  Order.findOne = async () => instance;

  try {
    const response = await request(app)
      .patch("/api/admin/orders/5/status")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ status: "ORDERED" });

    expect(response.statusCode).toBe(200);
    expect(response.body.order_status).toBe("ORDERED");
    expect(response.body.stock_increased).toBe(false);
    expect(saveCalls.length).toBe(1);
    expect(saveCalls[0].transaction).toBeTruthy();
  } finally {
    Order.findOne = originalOrderFindOne;
    restoreTransaction();
  }
});

test("ORDERED to COMPLETED increases store stock by ordered quantity", async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const { instance, saveCalls } = buildOrderInstance({
    orderStatus: "ORDERED",
    orderQuantity: 12,
  });
  const originalOrderFindOne = Order.findOne;
  const originalInventoryFindOne = StoreInventory.findOne;

  Order.findOne = async () => instance;

  const incrementCalls = [];
  StoreInventory.findOne = async (args) => {
    expect(args.where.storeId).toBe(1);
    expect(args.where.productId).toBe(1);
    return {
      currentStock: 3,
      increment: async (field, options) => {
        incrementCalls.push({ field, options });
      },
    };
  };

  try {
    const response = await request(app)
      .patch("/api/admin/orders/5/status")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ status: "COMPLETED" });

    expect(response.statusCode).toBe(200);
    expect(response.body.order_status).toBe("COMPLETED");
    expect(response.body.stock_increased).toBe(true);
    expect(saveCalls.length).toBe(1);
    expect(incrementCalls.length).toBe(1);
    expect(incrementCalls[0].field).toBe("currentStock");
    expect(incrementCalls[0].options.by).toBe(12);
  } finally {
    Order.findOne = originalOrderFindOne;
    StoreInventory.findOne = originalInventoryFindOne;
    restoreTransaction();
  }
});

test("invalid status transitions are rejected", async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const originalOrderFindOne = Order.findOne;

  const cases = [
    { current: "ORDERED", next: "PENDING" },
    { current: "COMPLETED", next: "ORDERED" },
    { current: "CANCELLED", next: "COMPLETED" },
    { current: "PENDING", next: "COMPLETED" },
  ];

  try {
    for (const { current, next } of cases) {
      const { instance } = buildOrderInstance({ orderStatus: current });
      Order.findOne = async () => instance;

      const response = await request(app)
        .patch("/api/admin/orders/5/status")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ status: next });

      expect(response.statusCode).toBe(409);
      expect(response.body.error).toBe("INVALID_ORDER_STATUS");
    }
  } finally {
    Order.findOne = originalOrderFindOne;
    restoreTransaction();
  }
});

test("status change validates input and order existence", async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const originalOrderFindOne = Order.findOne;
  Order.findOne = async () => null;

  try {
    const badStatus = await request(app)
      .patch("/api/admin/orders/5/status")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ status: "WRONG" });
    expect(badStatus.statusCode).toBe(400);

    const missingStatus = await request(app)
      .patch("/api/admin/orders/5/status")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({});
    expect(missingStatus.statusCode).toBe(400);

    const notFound = await request(app)
      .patch("/api/admin/orders/999/status")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ status: "ORDERED" });
    expect(notFound.statusCode).toBe(404);

    const badOrderId = await request(app)
      .patch("/api/admin/orders/abc/status")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ status: "ORDERED" });
    expect(badOrderId.statusCode).toBe(400);
  } finally {
    Order.findOne = originalOrderFindOne;
    restoreTransaction();
  }
});
