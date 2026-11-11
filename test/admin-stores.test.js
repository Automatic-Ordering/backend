const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { app, adminToken, setConnectionMock, setQueryMock } = require('./support/test-app');

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
        // 첫 번째 시도에는 중복된 코드가 존재한다고 응답
        return [[{ store_id: 99, store_code: '11111', status: 'ACTIVE' }]];
      }
      // 두 번째 시도에는 중복 없음
      return [[]];
    }
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

test('rejects store creation when store_name is empty or missing', async () => {
  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: '   ' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'INVALID_INPUT');
});

test('rejects invalid store creation input', async () => {
  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_code: 'STORE001', store_name: 'Test Store', password: 'short' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'INVALID_INPUT');
});

test('returns not found for an invalid store id', async () => {
  const response = await request(app)
    .get('/api/admin/stores/not-a-number')
    .set('Authorization', `Bearer ${adminToken()}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'NOT_FOUND');
});
