const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { sequelize } = require('../config/database');
const { app, adminToken, storeToken, setQueryMock } = require('./support/test-app');

test('returns only the authenticated store inventory for active products', async () => {
  const originalQuery = sequelize.query;
  const queryCalls = [];

  setQueryMock(async (sql) => {
    if (sql.includes('FROM stores s')) {
      return [[{
        store_id: 1,
        store_code: '10001',
        store_name: 'Store A',
        status: 'ACTIVE',
        account_id: 1,
        password_change_required: 0,
      }]];
    }
    if (sql.includes('FROM admins')) {
      return [[{ admin_id: 1 }]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });

  sequelize.query = async (sql, options) => {
    queryCalls.push({ sql, options });
    return [[
      {
        product_id: 2,
        product_name: 'Cup Noodles',
        category: 'Noodles',
        price: '1500.00',
        is_registered: 1,
        current_stock: 20,
        safety_stock: 5,
      },
      {
        product_id: 1,
        product_name: 'Kimbap',
        category: 'Rice',
        price: '1200.00',
        is_registered: 0,
        current_stock: null,
        safety_stock: null,
      },
    ]];
  };

  try {
    const response = await request(app)
      .get('/api/store/products?store_id=99999')
      .set('Authorization', `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        product_id: 2,
        product_name: 'Cup Noodles',
        category: 'Noodles',
        price: 1500,
        is_registered: true,
        current_stock: 20,
        safety_stock: 5,
      },
      {
        product_id: 1,
        product_name: 'Kimbap',
        category: 'Rice',
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

test('requires store authentication for the store product list', async () => {
  const unauthenticated = await request(app).get('/api/store/products');
  assert.equal(unauthenticated.status, 401);

  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) {
      return [[{ admin_id: 1 }]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });

  const adminResponse = await request(app)
    .get('/api/store/products')
    .set('Authorization', `Bearer ${adminToken()}`);
  assert.equal(adminResponse.status, 403);
});
