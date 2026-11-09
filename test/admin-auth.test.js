const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { app, setQueryMock } = require('./support/test-app');

test('rejects invalid admin login input and credentials', async () => {
  setQueryMock(async () => [[]]);

  const input = await request(app).post('/api/admin/auth/login').send({});
  const credentials = await request(app)
    .post('/api/admin/auth/login')
    .send({ admin_username: 'admin', password: 'wrong-password' });

  assert.equal(input.status, 400);
  assert.equal(credentials.status, 401);
});

test('does not allow a store token to access admin APIs', async () => {
  const { storeToken } = require('./support/test-app');
  setQueryMock(async (sql) => {
    if (sql.includes('FROM stores s')) {
      return [[{
        store_id: 1,
        store_code: 'STORE-12345678',
        store_name: 'Test Store',
        status: 'ACTIVE',
        account_id: 1,
        password_change_required: 0,
      }]];
    }
    return [[]];
  });

  const response = await request(app)
    .get('/api/admin/stores')
    .set('Authorization', `Bearer ${storeToken()}`);

  assert.equal(response.status, 403);
});
