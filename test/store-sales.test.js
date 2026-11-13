const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { sequelize } = require('../config/database');
const { Sales } = require('../models');
const { app, adminToken, storeToken, setQueryMock } = require('./support/test-app');

const setStoreAuthMock = () => {
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
};

const buildSalesRows = (count, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({
    salesId: 1200 - offset - i,
    storeId: 1,
    productId: 1,
    salesQuantity: 2,
    salesDate: new Date(`2026-11-08T09:00:00`),
    product: { productId: 1, productName: '참치마요 삼각김밥', category: '삼각김밥 / 샌드위치' },
  }));

test('sales endpoints require store authentication', async () => {
  const unauthorized = await request(app).get('/api/store/sales');
  assert.equal(unauthorized.status, 401);

  setStoreAuthMock();
  const forbidden = await request(app)
    .get('/api/store/sales')
    .set('Authorization', `Bearer ${adminToken()}`);
  assert.equal(forbidden.status, 403);
});

test('sales history returns paginated wrapper', async () => {
  setStoreAuthMock();

  const findAllCalls = [];
  const countCalls = [];
  const originalFindAll = Sales.findAll;
  const originalCount = Sales.count;

  Sales.findAll = async (args) => {
    findAllCalls.push(args);
    return buildSalesRows(2, 20);
  };
  Sales.count = async (args) => {
    countCalls.push(args);
    return 1200;
  };

  try {
    const response = await request(app)
      .get('/api/store/sales?page=2&limit=2')
      .set('Authorization', `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.items.length, 2);
    assert.equal(response.body.items[0].sales_id, 1180);
    assert.equal(response.body.items[0].product_name, '참치마요 삼각김밥');
    assert.equal(response.body.items[0].sales_quantity, 2);
    assert.equal(response.body.total, 1200);
    assert.equal(response.body.page, 2);
    assert.equal(response.body.limit, 2);
    assert.equal(response.body.total_pages, 600);
    assert.equal(findAllCalls[0].where.storeId, 1);
    assert.equal(findAllCalls[0].limit, 2);
    assert.equal(findAllCalls[0].offset, 2);
    assert.equal(countCalls[0].where.storeId, 1);
  } finally {
    Sales.findAll = originalFindAll;
    Sales.count = originalCount;
  }
});

test('sales history keeps date filters and default pagination', async () => {
  setStoreAuthMock();

  const findAllCalls = [];
  const originalFindAll = Sales.findAll;
  const originalCount = Sales.count;

  Sales.findAll = async (args) => {
    findAllCalls.push(args);
    return [];
  };
  Sales.count = async () => 0;

  try {
    const response = await request(app)
      .get('/api/store/sales?from=2026-11-01&to=2026-11-08')
      .set('Authorization', `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.items, []);
    assert.equal(response.body.total, 0);
    assert.equal(response.body.page, 1);
    assert.equal(response.body.limit, 20);
    assert.equal(response.body.total_pages, 0);
    assert.equal(findAllCalls[0].where.storeId, 1);
    assert.ok(findAllCalls[0].where.salesDate);
  } finally {
    Sales.findAll = originalFindAll;
    Sales.count = originalCount;
  }
});

test('sales history rejects invalid pagination and date params', async () => {
  setStoreAuthMock();

  const cases = [
    ['page=0', /page/],
    ['page=abc', /page/],
    ['limit=0', /limit/],
    ['limit=101', /limit/],
    ['from=2026-1-1', /from/],
    ['to=bad-date', /to/],
    ['from=2026-11-08&to=2026-11-01', /from/],
  ];

  for (const [query, pattern] of cases) {
    const response = await request(app)
      .get(`/api/store/sales?${query}`)
      .set('Authorization', `Bearer ${storeToken()}`);
    assert.equal(response.status, 400, query);
    assert.match(response.body.message, pattern, query);
  }
});
