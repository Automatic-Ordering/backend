const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const {
  app,
  adminToken,
  setConnectionMock,
  setQueryMock,
} = require('./support/test-app');

const createConnection = ({ insertResult = { insertId: 42 }, storeInsertError } = {}) => {
  const calls = [];
  return {
    calls,
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    query: async (sql) => {
      calls.push(sql);
      if (sql.includes('INSERT INTO stores') && storeInsertError) {
        if (typeof storeInsertError === 'function') {
          const error = storeInsertError();
          if (error) throw error;
          return [insertResult];
        }
        throw storeInsertError;
      }
      if (sql.includes('INSERT INTO stores')) return [insertResult];
      return [{ affectedRows: 1 }];
    },
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
    .send({ store_name: '  Test Store  ', initial_password: 'StorePass123!' });

  assert.equal(response.status, 201);
  assert.equal(response.body.store_id, 42);
  assert.equal(response.body.store_name, 'Test Store');
  assert.match(response.body.store_code, /^\d{5}$/);
  assert.deepEqual(connection.calls.slice(0, 2), ['begin', 'INSERT INTO stores (store_name, store_code, status) VALUES (?, ?, ?)']);
  assert.equal(connection.calls.at(-2), 'commit');
  assert.equal(connection.calls.at(-1), 'release');
});

test('rejects store creation without a valid initial password', async () => {
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    throw new Error(`Unexpected query: ${sql}`);
  });
  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: 'Test Store', initial_password: 'short' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'INVALID_INPUT');
});

test('retries duplicate store codes and rolls back database errors', async () => {
  let attempts = 0;
  const connection = createConnection({
    storeInsertError: () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('duplicate');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
    },
  });
  setConnectionMock(connection);
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    throw new Error(`Unexpected query: ${sql}`);
  });

  const response = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: 'Retry Store', initial_password: 'StorePass123!' });

  assert.equal(response.status, 201);
  assert.equal(attempts, 2);

  const failingConnection = createConnection({
    storeInsertError: new Error('database unavailable'),
  });
  setConnectionMock(failingConnection);
  const failedResponse = await request(app)
    .post('/api/admin/stores')
    .set('Authorization', `Bearer ${adminToken()}`)
    .send({ store_name: 'Failed Store', initial_password: 'StorePass123!' });

  assert.equal(failedResponse.status, 500);
  assert.ok(failingConnection.calls.includes('rollback'));
});

test('lists, updates, and suspends stores for an administrator', async () => {
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) return [[{ admin_id: 1 }]];
    if (sql.includes('SELECT store_id, store_name')) return [[{ store_id: 1, store_name: 'Store', status: 'ACTIVE' }]];
    return [{ affectedRows: 1 }];
  });
  const token = `Bearer ${adminToken()}`;

  const list = await request(app).get('/api/admin/stores').set('Authorization', token);
  const update = await request(app).patch('/api/admin/stores/1').set('Authorization', token).send({ store_name: 'Updated' });
  const status = await request(app).patch('/api/admin/stores/1/status').set('Authorization', token).send({ status: 'SUSPENDED' });

  assert.equal(list.status, 200);
  assert.equal(list.body[0].store_id, 1);
  assert.deepEqual(update.body, { store_id: 1, store_name: 'Updated' });
  assert.deepEqual(status.body, { store_id: 1, status: 'SUSPENDED' });
});
