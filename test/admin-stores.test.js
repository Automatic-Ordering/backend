const bcrypt = require("bcrypt");
const request = require("supertest");
const {
  app,
  adminToken,
  storeToken,
  setConnectionMock,
  setQueryMock,
  resetTestCaptures,
  setForceBulkError,
  getCapturedStoreCreateTx,
  getCapturedStoreAccountCreateTx,
  getCapturedBulkRows,
  getCapturedBulkTx,
  getCapturedStoreAccountUpdate,
} = require("./support/test-app");

const createConnection = () => {
  const calls = [];
  return {
    calls,
    query: async (sql) => {
      calls.push(sql);
      if (sql.includes("INSERT INTO stores")) return [{ insertId: 42 }];
      return [{ affectedRows: 1 }];
    },
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
  };
};

test("creates a store and account in one transaction", async () => {
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM products"))
      return [
        [
          { product_id: 1, category: "도시락 / 김밥" },
          { product_id: 2, category: "음료 / 생수" },
        ],
      ];
    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app)
    .post("/api/admin/stores")
    .set("Authorization", `Bearer ${adminToken()}`)
    .send({
      store_code: "STORE001",
      store_name: "Test Store",
      password: "StorePass123!",
    });

  expect(response.statusCode).toBe(201);
  expect(response.body).toEqual({
    store_id: 42,
    store_code: "STORE001",
    store_name: "Test Store",
    status: "ACTIVE",
  });
  expect(connection.calls.some((sql) => sql.includes("INSERT INTO stores"))).toBeTruthy();
  expect(
    connection.calls.some((sql) => sql.includes("INSERT INTO store_accounts"))
  ).toBeTruthy();
  expect(connection.calls).toContain("commit");
});

test("creates a store with auto-generated 5-digit store_code when only store_name is provided", async () => {
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores")) return [[]];
    if (sql.includes("FROM products"))
      return [
        [
          { product_id: 1, category: "도시락 / 김밥" },
          { product_id: 2, category: "음료 / 생수" },
        ],
      ];
    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app)
    .post("/api/admin/stores")
    .set("Authorization", `Bearer ${adminToken()}`)
    .send({ store_name: "자동발주 1호점" });

  expect(response.statusCode).toBe(201);
  expect(response.body.store_id).toBe(42);
  expect(response.body.store_name).toBe("자동발주 1호점");
  expect(response.body.status).toBe("ACTIVE");
  expect(response.body.store_code).toMatch(/^\d{5}$/);
  expect(
    response.body.initial_password
  ).toBe(
    `Store${response.body.store_code}!`
  );
  expect(connection.calls.some((sql) => sql.includes("INSERT INTO stores"))).toBeTruthy();
  expect(
    connection.calls.some((sql) => sql.includes("INSERT INTO store_accounts"))
  ).toBeTruthy();
  expect(connection.calls).toContain("commit");
});

test("retries store code generation when candidate code already exists", async () => {
  const connection = createConnection();
  setConnectionMock(connection);
  let storeCheckCount = 0;
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores")) {
      storeCheckCount += 1;
      if (storeCheckCount === 1) {
        return [[{ store_id: 99, store_code: "11111", status: "ACTIVE" }]];
      }
      return [[]];
    }
    if (sql.includes("FROM products"))
      return [
        [
          { product_id: 1, category: "도시락 / 김밥" },
          { product_id: 2, category: "음료 / 생수" },
        ],
      ];
    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app)
    .post("/api/admin/stores")
    .set("Authorization", `Bearer ${adminToken()}`)
    .send({ store_name: "자동발주 2호점" });

  expect(response.statusCode).toBe(201);
  expect(response.body.store_id).toBe(42);
  expect(response.body.store_name).toBe("자동발주 2호점");
  expect(response.body.store_code).toMatch(/^\d{5}$/);
  expect(storeCheckCount).toBeGreaterThanOrEqual(2);
});

/* NEW TESTS */

test("inventory bulkCreate is called with correct rows and transaction", async () => {
  resetTestCaptures();
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores")) return [[]];
    if (sql.includes("FROM products"))
      return [
        [
          { product_id: 1, category: "도시락 / 김밥" },
          { product_id: 2, category: "음료 / 생수" },
        ],
      ];
    return [];
  });

  const response = await request(app)
    .post("/api/admin/stores")
    .set("Authorization", `Bearer ${adminToken()}`)
    .send({ store_name: "InventoryTest" });

  expect(response.statusCode).toBe(201);
  const rows = getCapturedBulkRows();
  expect(
    Array.isArray(rows) && rows.length > 0
  ).toBeTruthy();
  rows.forEach((row) => {
    expect(row.storeId).toBe(response.body.store_id);
    expect(row.currentStock).toBe(0);
    expect(Number.isInteger(row.safetyStock) && row.safetyStock >= 0).toBeTruthy();
  });
  expect(
    getCapturedStoreCreateTx()
  ).toBe(
    getCapturedStoreAccountCreateTx()
  );
  expect(getCapturedStoreCreateTx()).toBe(getCapturedBulkTx());
});

test("transaction rollback occurs when inventory bulkCreate fails", async () => {
  resetTestCaptures();
  setForceBulkError(true);
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores")) return [[]];
    if (sql.includes("FROM products"))
      return [
        [
          { product_id: 1, category: "도시락 / 김밥" },
          { product_id: 2, category: "음료 / 생수" },
        ],
      ];
    return [];
  });

  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await request(app)
      .post("/api/admin/stores")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ store_name: "RollbackTest" });

    expect(response.statusCode).toBe(500);
    expect(
      connection.calls.includes("rollback")
    ).toBeTruthy();
  } finally {
    errorSpy.mockRestore();
  }
});

/* Password reset tests */

test("resets store password and returns temporary password", async () => {
  resetTestCaptures();
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores"))
      return [
        [
          {
            store_id: 7,
            store_name: "테스트점",
            store_code: "50001",
            status: "ACTIVE",
          },
        ],
      ];
    if (sql.includes("FROM store_accounts"))
      return [
        [
          {
            account_id: 3,
            store_id: 7,
            password_hash: "$2b$12$oldpasswordhashvalue",
            password_change_required: 0,
          },
        ],
      ];
    return [];
  });

  const response = await request(app)
    .patch("/api/admin/stores/7/password/reset")
    .set("Authorization", `Bearer ${adminToken()}`);

  expect(response.statusCode).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe("점포 비밀번호가 초기화되었습니다.");
  expect(response.body.data.temporaryPassword).toBe("Store50001!");

  const update = getCapturedStoreAccountUpdate();
  expect(update).toBeTruthy();
  expect(update.passwordChangeRequired).toBe(true);
  expect(
    update.passwordHash.startsWith("$2b$12$")
  ).toBeTruthy();
  expect(
    update.passwordHash
  ).not.toBe(
    response.body.data.temporaryPassword
  );
  expect(
    bcrypt.compareSync(
      response.body.data.temporaryPassword,
      update.passwordHash,
    )
  ).toBeTruthy();
  expect(
    !JSON.stringify(response.body).includes(update.passwordHash)
  ).toBeTruthy();
});

test("returns 404 when store does not exist for password reset", async () => {
  resetTestCaptures();
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores")) return [[]];
    return [];
  });

  const response = await request(app)
    .patch("/api/admin/stores/999/password/reset")
    .set("Authorization", `Bearer ${adminToken()}`);

  expect(response.statusCode).toBe(404);
  expect(response.body.message).toBe("점포를 찾을 수 없습니다.");
  expect(getCapturedStoreAccountUpdate()).toBeNull();
});

test("returns 404 when store account does not exist for password reset", async () => {
  resetTestCaptures();
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores"))
      return [
        [
          {
            store_id: 7,
            store_name: "테스트점",
            store_code: "50001",
            status: "ACTIVE",
          },
        ],
      ];
    if (sql.includes("FROM store_accounts")) return [[]];
    return [];
  });

  const response = await request(app)
    .patch("/api/admin/stores/7/password/reset")
    .set("Authorization", `Bearer ${adminToken()}`);

  expect(response.statusCode).toBe(404);
  expect(response.body.message).toBe("점포 계정을 찾을 수 없습니다.");
  expect(getCapturedStoreAccountUpdate()).toBeNull();
});

test("rejects password reset for store role tokens", async () => {
  resetTestCaptures();
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) return [[{ admin_id: 1 }]];
    if (sql.includes("FROM stores"))
      return [
        [
          {
            store_id: 1,
            store_name: "점포",
            store_code: "10001",
            status: "ACTIVE",
            account_id: 1,
            password_hash: "$2b$12$storehash",
            password_change_required: 0,
          },
        ],
      ];
    return [];
  });

  const response = await request(app)
    .patch("/api/admin/stores/1/password/reset")
    .set("Authorization", `Bearer ${storeToken()}`);

  expect(response.statusCode).toBe(403);
  expect(response.body.error).toBe("FORBIDDEN");
  expect(getCapturedStoreAccountUpdate()).toBeNull();
});
