const request = require("supertest");
const { sequelize } = require("../config/database");
const {
  app,
  adminToken,
  storeToken,
  setQueryMock,
} = require("./support/test-app");

test("returns only the authenticated store inventory for active products", async () => {
  const originalQuery = sequelize.query;
  const queryCalls = [];

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

  sequelize.query = async (sql, options) => {
    queryCalls.push({ sql, options });
    return [
      [
        {
          product_id: 2,
          product_name: "Cup Noodles",
          category: "Noodles",
          price: "1500.00",
          is_registered: 1,
          current_stock: 20,
          safety_stock: 5,
        },
        {
          product_id: 1,
          product_name: "Kimbap",
          category: "Rice",
          price: "1200.00",
          is_registered: 0,
          current_stock: null,
          safety_stock: null,
        },
      ],
    ];
  };

  try {
    const response = await request(app)
      .get("/api/store/products?store_id=99999")
      .set("Authorization", `Bearer ${storeToken()}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([
      {
        product_id: 2,
        product_name: "Cup Noodles",
        category: "Noodles",
        price: 1500,
        is_registered: true,
        current_stock: 20,
        safety_stock: 5,
      },
      {
        product_id: 1,
        product_name: "Kimbap",
        category: "Rice",
        price: 1200,
        is_registered: false,
        current_stock: null,
        safety_stock: null,
      },
    ]);
    expect(queryCalls.length).toBe(1);
    expect(queryCalls[0].options.replacements.storeId).toBe(1);
    expect(queryCalls[0].sql).toMatch(/LEFT JOIN store_inventories/i);
    expect(queryCalls[0].sql).toMatch(/si\.store_id = :storeId/i);
  } finally {
    sequelize.query = originalQuery;
  }
});

test("requires store authentication for the store product list", async () => {
  const unauthenticated = await request(app).get("/api/store/products");
  expect(unauthenticated.statusCode).toBe(401);

  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });

  const adminResponse = await request(app)
    .get("/api/store/products")
    .set("Authorization", `Bearer ${adminToken()}`);
  expect(adminResponse.statusCode).toBe(403);
});

test("paginated mode returns registered products with search", async () => {
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

  const queryCalls = [];
  const originalQuery = sequelize.query;

  sequelize.query = async (sql, options) => {
    queryCalls.push({ sql, options });
    if (sql.includes("COUNT(*)")) {
      return [[{ total: 12 }]];
    }
    return [
      [
        {
          product_id: 2,
          product_name: "Cup Noodles",
          category: "Noodles",
          price: "1500.00",
          is_registered: 1,
          current_stock: 20,
          safety_stock: 5,
        },
      ],
    ];
  };

  try {
    const response = await request(app)
      .get("/api/store/products?page=2&limit=5&search=컵면")
      .set("Authorization", `Bearer ${storeToken()}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.items.length).toBe(1);
    expect(response.body.total).toBe(12);
    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(5);
    expect(response.body.total_pages).toBe(3);

    const first = response.body.items[0];
    expect(first.product_id).toBe(2);
    expect(first.is_registered).toBe(true);
    expect(first.current_stock).toBe(20);

    expect(queryCalls.length).toBe(2);
    expect(queryCalls[0].sql).toMatch(/COUNT\(\*\)/i);
    expect(queryCalls[0].options.replacements.storeId).toBe(1);
    expect(queryCalls[0].options.replacements.search).toBe("%컵면%");
    expect(queryCalls[1].sql).toMatch(/LIMIT :limit OFFSET :offset/i);
    expect(queryCalls[1].options.replacements.limit).toBe(5);
    expect(queryCalls[1].options.replacements.offset).toBe(5);
    expect(queryCalls[1].sql).toMatch(/si\.inventory_id IS NOT NULL/i);

    const invalidPage = await request(app)
      .get("/api/store/products?page=0")
      .set("Authorization", `Bearer ${storeToken()}`);
    expect(invalidPage.statusCode).toBe(400);
    expect(invalidPage.body.message).toMatch(/page/);
  } finally {
    sequelize.query = originalQuery;
  }
});
