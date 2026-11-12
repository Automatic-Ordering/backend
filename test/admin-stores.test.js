const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const {
  app,
  adminToken,
  setConnectionMock,
  setQueryMock,
  resetTestCaptures,
  setForceBulkError,
  getCapturedStoreCreateTx,
  getCapturedStoreAccountCreateTx,
  getCapturedBulkRows,
  getCapturedBulkTx,
} = require('./support/test-app');

const createConnection = () => {
  const calls = [];
  return {
    calls,
    query: async (sql) => {
      calls.push(sql);
      if (sql.includes('INSERT INTO stores')) return [{ insertId: 42 }];
      return [{ affectedRows: 1 }];
    },
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
  };
};

test('creates a store and account in one transaction', async () => {
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    if (sql.includes('FROM products')) return [[{ product_id: 1, category: '도시락 / 김밥' }, { product_id: 2, category: '음료 / 생수' }]];
    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_code: 'STORE001', store_name: 'Test Store', password: 'StorePass123!' });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, {
    store_id: 42,
    store_code: 'STORE001',
    store_name: 'Test Store',
    status: 'ACTIVE',
  });
  assert.ok(connection.calls.some((sql) => sql.includes('INSERT INTO stores')));
  assert.ok(connection.calls.some((sql) => sql.includes('INSERT INTO store_accounts')));
  assert.ok(connection.calls.includes('commit'));
});

test('creates a store with auto-generated 5-digit store_code when only store_name is provided', async () => {
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    if (sql.includes('FROM stores')) return [[]];
    if (sql.includes('FROM products')) return [[{ product_id: 1, category: '도시락 / 김밥' }, { product_id: 2, category: '음료 / 생수' }]];
    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: '자동발주 1호점' });

  assert.equal(response.status, 201);
  assert.equal(response.body.store_id, 42);
  assert.equal(response.body.store_name, '자동발주 1호점');
  assert.equal(response.body.status, 'ACTIVE');
  assert.match(response.body.store_code, /^\d{5}$/);
  assert.equal(response.body.initial_password, `Store${response.body.store_code}!`);
  assert.ok(connection.calls.some((sql) => sql.includes('INSERT INTO stores')));
  assert.ok(connection.calls.some((sql) => sql.includes('INSERT INTO store_accounts')));
  assert.ok(connection.calls.includes('commit'));
});

test('retries store code generation when candidate code already exists', async () => {
  const connection = createConnection();
  setConnectionMock(connection);
  let storeCheckCount = 0;
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    if (sql.includes('FROM stores')) {
      storeCheckCount += 1;
      if (storeCheckCount === 1) {
        return [[{ store_id: 99, store_code: '11111', status: 'ACTIVE' }]];
      }
      return [[]];
    }
    if (sql.includes('FROM products')) return [[{ product_id: 1, category: '도시락 / 김밥' }, { product_id: 2, category: '음료 / 생수' }]];
    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: '자동발주 2호점' });

  assert.equal(response.status, 201);
  assert.equal(response.body.store_id, 42);
  assert.equal(response.body.store_name, '자동발주 2호점');
  assert.match(response.body.store_code, /^\d{5}$/);
  assert.ok(storeCheckCount >= 2, 'Should have queried stores at least twice due to duplicate code');
});

/* NEW TESTS */

test('inventory bulkCreate is called with correct rows and transaction', async () => {
  resetTestCaptures();
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    if (sql.includes('FROM stores')) return [[]];
    if (sql.includes('FROM products')) return [[{ product_id: 1, category: '도시락 / 김밥' }, { product_id: 2, category: '음료 / 생수' }]];
    return [];
  });

  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: 'InventoryTest' });

  assert.equal(response.status, 201);
  const rows = getCapturedBulkRows();
  assert.ok(Array.isArray(rows) && rows.length > 0, 'bulkCreate should receive rows');
  rows.forEach((row) => {
    assert.equal(row.storeId, response.body.store_id);
    assert.equal(row.currentStock, 0);
    assert.ok(Number.isInteger(row.safetyStock) && row.safetyStock >= 0);
  });
  assert.strictEqual(getCapturedStoreCreateTx(), getCapturedStoreAccountCreateTx());
  assert.strictEqual(getCapturedStoreCreateTx(), getCapturedBulkTx());
});

test('transaction rollback occurs when inventory bulkCreate fails', async () => {
  resetTestCaptures();
  setForceBulkError(true);
  const connection = createConnection();
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    if (sql.includes('FROM stores')) return [[]];
    if (sql.includes('FROM products')) return [[{ product_id: 1, category: '도시락 / 김밥' }, { product_id: 2, category: '음료 / 생수' }]];
    return [];
  });

  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: 'RollbackTest' });

  assert.equal(response.status, 500);
  assert.ok(connection.calls.includes('rollback'), 'Transaction should be rolled back');
});
