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
