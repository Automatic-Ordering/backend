const request = require("supertest");
const { app, storeToken, setQueryMock } = require("./support/test-app");

test("logs a store in and returns its verified profile", async () => {
  setQueryMock(async (sql) => {
    if (sql.includes("WHERE s.store_code")) {
      return [
        [
          {
            store_id: 1,
            status: "ACTIVE",
            password_hash:
              "$2b$04$GGxI80I16ZwHT968D2B3l.TxDW.rbCk4yGwPUk.61OQbK2mKlNr4K",
          },
        ],
      ];
    }
    if (sql.includes("FROM stores s")) {
      return [
        [
          {
            store_id: 1,
            store_code: "STORE-12345678",
            store_name: "Test Store",
            status: "ACTIVE",
            account_id: 9,
            password_change_required: 0,
          },
        ],
      ];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  const invalid = await request(app)
    .post("/api/auth/login")
    .send({ store_code: "UNKNOWN", password: "bad" });
  expect(invalid.statusCode).toBe(401);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ store_code: "STORE-12345678", password: "StorePass123!" });
  expect(login.statusCode).toBe(200);
  expect(login.body.token_type).toBe("Bearer");

  const profile = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${login.body.token}`);
  expect(profile.statusCode).toBe(200);
  expect(profile.body.storeId).toBe(1);
  expect(profile.body.role).toBe("STORE");
});

test("blocks missing and invalid store authentication", async () => {
  const missing = await request(app).get("/api/auth/me");
  const invalid = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer invalid");
  expect(missing.statusCode).toBe(401);
  expect(invalid.statusCode).toBe(401);
});
