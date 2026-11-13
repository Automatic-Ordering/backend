const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { sequelize } = require('../config/database');
const { StoreInventory, Order } = require('../models');
const { app, adminToken, storeToken, setQueryMock } = require('./support/test-app');

const setAdminAuthMock = () => {
  setQueryMock(async (sql) => {
    if (sql.includes('FROM admins')) {
      return [[{ admin_id: 1 }]];
    }
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
    throw new Error(`Unexpected authentication query: ${sql}`);
  });
};

const mockTransaction = () => {
  const original = sequelize.transaction;
  sequelize.transaction = async (callback) => callback({});
  return () => {
    sequelize.transaction = original;
  };
};

const buildOrderInstance = ({ orderStatus, orderQuantity = 10, storeId = 1, productId = 1 }) => {
  const saveCalls = [];
  return {
    instance: {
      orderId: 5,
      storeId,
      productId,
      orderQuantity,
      orderStatus,
      product: { productId, productName: '참치마요 삼각김밥' },
      save: async (options) => {
        saveCalls.push(options);
        return undefined;
      },
    },
    saveCalls,
  };
};

test('admin order endpoints require admin authentication', async () => {
  const unauthorized = await request(app).get('/api/admin/orders');
  assert.equal(unauthorized.status, 401);

  setAdminAuthMock();
  const forbidden = await request(app)
    .get('/api/admin/orders')
    .set('Authorization', `Bearer ${storeToken()}`);
  assert.equal(forbidden.status, 403);
});

test('admin can list orders with filters', async () => {
  setAdminAuthMock();

  const findAllCalls = [];
  const originalOrderFindAll = Order.findAll;
  Order.findAll = async (args) => {
    findAllCalls.push(args);
    return [];
  };

  try {
    const response = await request(app)
      .get('/api/admin/orders?store_id=2&status=PENDING')
      .set('Authorization', `Bearer ${adminToken()}`);

    assert.equal(response.status, 200);
    assert.equal(findAllCalls[0].where.storeId, 2);
    assert.equal(findAllCalls[0].where.orderStatus, 'PENDING');

    const invalidStore = await request(app)
      .get('/api/admin/orders?store_id=abc')
      .set('Authorization', `Bearer ${adminToken()}`);
    assert.equal(invalidStore.status, 400);

    const invalidStatus = await request(app)
      .get('/api/admin/orders?status=NOPE')
      .set('Authorization', `Bearer ${adminToken()}`);
    assert.equal(invalidStatus.status, 400);
  } finally {
    Order.findAll = originalOrderFindAll;
  }
});

test('PENDING order can transition to ORDERED without stock change', async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const { instance, saveCalls } = buildOrderInstance({ orderStatus: 'PENDING' });
  const originalOrderFindOne = Order.findOne;
  Order.findOne = async () => instance;

  try {
    const response = await request(app)
      .patch('/api/admin/orders/5/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'ORDERED' });

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, 'ORDERED');
    assert.equal(response.body.stock_increased, false);
    assert.equal(saveCalls.length, 1);
    assert.ok(saveCalls[0].transaction);
  } finally {
    Order.findOne = originalOrderFindOne;
    restoreTransaction();
  }
});

test('ORDERED to COMPLETED increases store stock by ordered quantity', async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const { instance, saveCalls } = buildOrderInstance({ orderStatus: 'ORDERED', orderQuantity: 12 });
  const originalOrderFindOne = Order.findOne;
  const originalInventoryFindOne = StoreInventory.findOne;

  Order.findOne = async () => instance;

  const incrementCalls = [];
  StoreInventory.findOne = async (args) => {
    assert.equal(args.where.storeId, 1);
    assert.equal(args.where.productId, 1);
    return {
      currentStock: 3,
      increment: async (field, options) => {
        incrementCalls.push({ field, options });
      },
    };
  };

  try {
    const response = await request(app)
      .patch('/api/admin/orders/5/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'COMPLETED' });

    assert.equal(response.status, 200);
    assert.equal(response.body.order_status, 'COMPLETED');
    assert.equal(response.body.stock_increased, true);
    assert.equal(saveCalls.length, 1);
    assert.equal(incrementCalls.length, 1);
    assert.equal(incrementCalls[0].field, 'currentStock');
    assert.equal(incrementCalls[0].options.by, 12);
  } finally {
    Order.findOne = originalOrderFindOne;
    StoreInventory.findOne = originalInventoryFindOne;
    restoreTransaction();
  }
});

test('invalid status transitions are rejected', async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const originalOrderFindOne = Order.findOne;

  const cases = [
    { current: 'ORDERED', next: 'PENDING' },
    { current: 'COMPLETED', next: 'ORDERED' },
    { current: 'CANCELLED', next: 'COMPLETED' },
    { current: 'PENDING', next: 'COMPLETED' },
  ];

  try {
    for (const { current, next } of cases) {
      const { instance } = buildOrderInstance({ orderStatus: current });
      Order.findOne = async () => instance;

      const response = await request(app)
        .patch('/api/admin/orders/5/status')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: next });

      assert.equal(response.status, 409);
      assert.equal(response.body.error, 'INVALID_ORDER_STATUS');
    }
  } finally {
    Order.findOne = originalOrderFindOne;
    restoreTransaction();
  }
});

test('status change validates input and order existence', async () => {
  setAdminAuthMock();
  const restoreTransaction = mockTransaction();

  const originalOrderFindOne = Order.findOne;
  Order.findOne = async () => null;

  try {
    const badStatus = await request(app)
      .patch('/api/admin/orders/5/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'WRONG' });
    assert.equal(badStatus.status, 400);

    const missingStatus = await request(app)
      .patch('/api/admin/orders/5/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    assert.equal(missingStatus.status, 400);

    const notFound = await request(app)
      .patch('/api/admin/orders/999/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'ORDERED' });
    assert.equal(notFound.status, 404);

    const badOrderId = await request(app)
      .patch('/api/admin/orders/abc/status')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: 'ORDERED' });
    assert.equal(badOrderId.status, 400);
  } finally {
    Order.findOne = originalOrderFindOne;
    restoreTransaction();
  }
});
