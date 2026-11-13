const assert = require("node:assert/strict");
const test = require("node:test");
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

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
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
    assert.equal(queryCalls.length, 1);
    assert.equal(queryCalls[0].options.replacements.storeId, 1);
    assert.match(queryCalls[0].sql, /LEFT JOIN store_inventories/i);
    assert.match(queryCalls[0].sql, /si\.store_id = :storeId/i);
  } finally {
    sequelize.query = originalQuery;
  }
});

test("requires store authentication for the store product list", async () => {
  const unauthenticated = await request(app).get("/api/store/products");
  assert.equal(unauthenticated.status, 401);

  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });

  const adminResponse = await request(app)
    .get("/api/store/products")
    .set("Authorization", `Bearer ${adminToken()}`);
  assert.equal(adminResponse.status, 403);
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

    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.total, 12);
    assert.equal(response.body.page, 2);
    assert.equal(response.body.limit, 5);
    assert.equal(response.body.total_pages, 3);

    const first = response.body.items[0];
    assert.equal(first.product_id, 2);
    assert.equal(first.is_registered, true);
    assert.equal(first.current_stock, 20);

    assert.equal(queryCalls.length, 2);
    assert.match(queryCalls[0].sql, /COUNT\(\*\)/i);
    assert.equal(queryCalls[0].options.replacements.storeId, 1);
    assert.equal(queryCalls[0].options.replacements.search, "%컵면%");
    assert.match(queryCalls[1].sql, /LIMIT :limit OFFSET :offset/i);
    assert.equal(queryCalls[1].options.replacements.limit, 5);
    assert.equal(queryCalls[1].options.replacements.offset, 5);
    assert.match(queryCalls[1].sql, /si\.inventory_id IS NOT NULL/i);

    const invalidPage = await request(app)
      .get("/api/store/products?page=0")
      .set("Authorization", `Bearer ${storeToken()}`);
    assert.equal(invalidPage.status, 400);
    assert.match(invalidPage.body.message, /page/);
  } finally {
    sequelize.query = originalQuery;
  }
});
