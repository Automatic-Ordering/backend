const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const { sequelize } = require('../../config/database');
const { Admin, Store, StoreAccount, Product, StoreInventory } = require('../../models');

// ------------------------------------------------------------
// Tokens
// ------------------------------------------------------------
const adminToken = () =>
  jwt.sign({ adminId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
const storeToken = () =>
  jwt.sign({ storeId: 1, role: 'STORE' }, process.env.JWT_SECRET);

// ------------------------------------------------------------
// Query mock (used by model mocks)
// ------------------------------------------------------------
let queryMock = async () => [[]];

// ------------------------------------------------------------
// Capture variables
// ------------------------------------------------------------
let capturedStoreCreateTx = null;
let capturedStoreAccountCreateTx = null;
let capturedBulkRows = null;
let capturedBulkTx = null;
let forceBulkError = false;
let capturedCommitCount = 0;
let capturedRollbackCount = 0;
let bulkCreateCallCount = 0;
let capturedStoreAccountUpdate = null;

// ------------------------------------------------------------
// Reset / control helpers
// ------------------------------------------------------------
const resetTestCaptures = () => {
  capturedStoreCreateTx = null;
  capturedStoreAccountCreateTx = null;
  capturedBulkRows = null;
  capturedBulkTx = null;
  forceBulkError = false;
  capturedCommitCount = 0;
  capturedRollbackCount = 0;
  bulkCreateCallCount = 0;
  capturedStoreAccountUpdate = null;
};

const setForceBulkError = (flag) => {
  forceBulkError = !!flag;
};

const setQueryMock = (mock) => {
  queryMock = mock;
};

// ------------------------------------------------------------
// Getter utilities (used by tests)
// ------------------------------------------------------------
const getCapturedStoreCreateTx = () => capturedStoreCreateTx;
const getCapturedStoreAccountCreateTx = () => capturedStoreAccountCreateTx;
const getCapturedBulkRows = () => capturedBulkRows;
const getCapturedBulkTx = () => capturedBulkTx;
const getCapturedCommitCount = () => capturedCommitCount;
const getCapturedRollbackCount = () => capturedRollbackCount;
const getBulkCreateCallCount = () => bulkCreateCallCount;
const getCapturedStoreAccountUpdate = () => capturedStoreAccountUpdate;

// ------------------------------------------------------------
// Model Mocks
// ------------------------------------------------------------
Admin.findOne = async () => {
  const [rows] = await queryMock(
    'SELECT admin_id, password_hash FROM admins WHERE admin_username = ?'
  );
  const row = rows?.[0];
  return row ? { adminId: row.admin_id, passwordHash: row.password_hash } : null;
};

Admin.findByPk = async () => {
  const [rows] = await queryMock('SELECT admin_id FROM admins WHERE admin_id = ?');
  return rows?.[0] || null;
};

Store.findOne = async () => {
  const [rows] = await queryMock(
    'SELECT s.store_id, s.status, a.password_hash FROM stores s WHERE s.store_code = ?'
  );
  const row = rows?.[0];
  return row ? toStore(row) : null;
};

Store.findByPk = async () => {
  const [rows] = await queryMock(
    'SELECT store_id, store_name, store_code, status FROM stores s'
  );
  return toStore(rows?.[0]);
};

Store.findAll = async () => {
  const [rows] = await queryMock(
    'SELECT store_id, store_name, store_code, status, created_at FROM stores'
  );
  return (rows || []).map(toStore);
};

Store.create = async (values, { transaction }) => {
  capturedStoreCreateTx = transaction;
  const [result] = await transaction.query(
    'INSERT INTO stores (store_name, store_code, status) VALUES (?, ?, ?)'
  );
  return toStore({ store_id: result.insertId, ...values });
};

StoreAccount.findByPk = async () => {
  const [rows] = await queryMock(
    'SELECT password_hash FROM store_accounts WHERE account_id = ?'
  );
  const row = rows?.[0];
  return row ? { passwordHash: row.password_hash, update: async () => {} } : null;
};

StoreAccount.findOne = async () => {
  const [rows] = await queryMock(
    'SELECT account_id, store_id, password_hash, password_change_required FROM store_accounts WHERE store_id = ?'
  );
  return toStoreAccount(rows?.[0]);
};

StoreAccount.create = async (values, { transaction }) => {
  capturedStoreAccountCreateTx = transaction;
  await transaction.query(
    'INSERT INTO store_accounts (store_id, password_hash, password_change_required) VALUES (?, ?, TRUE)'
  );
  return values;
};

Product.findAll = async () => {
  const [rows] = await queryMock('SELECT product_id, category FROM products');
  return rows || [];
};

// StoreInventory bulkCreate mock
if (!StoreInventory) {
  throw new Error('StoreInventory model is not exported from models/index.js');
}
StoreInventory.bulkCreate = async (rows, { transaction }) => {
  if (!transaction) throw new Error('Transaction missing for StoreInventory.bulkCreate');
  capturedBulkRows = rows;
  capturedBulkTx = transaction;
  bulkCreateCallCount += 1;
  if (forceBulkError) {
    const err = new Error('Forced bulk error');
    err.name = 'SequelizeDatabaseError';
    throw err;
  }
  return rows;
};

// ------------------------------------------------------------
// Transaction mock
// ------------------------------------------------------------
const setConnectionMock = (connection) => {
  sequelize.transaction = async (callback) => {
    try {
      const result = await callback(connection);
      await connection.commit();
      capturedCommitCount += 1;
      return result;
    } catch (err) {
      await connection.rollback();
      capturedRollbackCount += 1;
      throw err;
    }
  };
};

// ------------------------------------------------------------
// Helper to convert raw DB rows to the shape used by tests
// ------------------------------------------------------------
const toStoreAccount = (row) => {
  if (!row) return null;
  const account = {
    accountId: row.account_id ?? row.accountId,
    storeId: row.store_id ?? row.storeId,
    passwordHash: row.password_hash ?? row.passwordHash,
    passwordChangeRequired: Boolean(row.password_change_required ?? row.passwordChangeRequired),
    update: async (values) => {
      capturedStoreAccountUpdate = values;
      await queryMock(
        `UPDATE store_accounts SET ${Object.keys(values).join(', ')} WHERE store_id = ?`
      );
      Object.assign(account, values);
    },
  };
  return account;
};

const toStore = (row) => {
  if (!row) return null;
  const store = {
    ...row,
    storeId: row.store_id ?? row.storeId,
    storeCode: row.store_code ?? row.storeCode,
    storeName: row.store_name ?? row.storeName,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    account:
      row.account_id || row.password_hash
        ? {
            accountId: row.account_id || 1,
            passwordHash: row.password_hash,
            passwordChangeRequired: Boolean(row.password_change_required),
          }
        : undefined,
    update: async (values) => {
      await queryMock(`UPDATE stores SET ${Object.keys(values).join(', ')} WHERE store_id = ?`);
      Object.assign(store, values);
    },
  };
  return store;
};

// ------------------------------------------------------------
// Export utilities for tests
// ------------------------------------------------------------
module.exports = {
  app,
  adminToken,
  storeToken,
  setQueryMock,
  setConnectionMock,
  resetTestCaptures,
  setForceBulkError,
  getCapturedStoreCreateTx,
  getCapturedStoreAccountCreateTx,
  getCapturedBulkRows,
  getCapturedBulkTx,
  getCapturedCommitCount,
  getCapturedRollbackCount,
  getBulkCreateCallCount,
  getCapturedStoreAccountUpdate,
};
