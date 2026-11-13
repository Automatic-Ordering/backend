const assert = require("node:assert/strict");
const test = require("node:test");
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
  assert.equal(invalid.status, 401);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ store_code: "STORE-12345678", password: "StorePass123!" });
  assert.equal(login.status, 200);
  assert.equal(login.body.token_type, "Bearer");

  const profile = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${login.body.token}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.storeId, 1);
  assert.equal(profile.body.role, "STORE");
});

test("blocks missing and invalid store authentication", async () => {
  const missing = await request(app).get("/api/auth/me");
  const invalid = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer invalid");
  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
});
