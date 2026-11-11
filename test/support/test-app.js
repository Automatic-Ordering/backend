const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const { sequelize } = require('../../config/database');
const { Admin, Store, StoreAccount } = require('../../models');

const adminToken = () => jwt.sign({ adminId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
const storeToken = () => jwt.sign({ storeId: 1, role: 'STORE' }, process.env.JWT_SECRET);

let queryMock = async () => [[]];

const toStore = (row) => {
  if (!row) return null;
  const store = {
    ...row,
    storeId: row.store_id ?? row.storeId,
    storeCode: row.store_code ?? row.storeCode,
    storeName: row.store_name ?? row.storeName,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    account: row.account_id || row.password_hash
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

const installModelMocks = () => {
  Admin.findOne = async () => {
    const [rows] = await queryMock('SELECT admin_id, password_hash FROM admins WHERE admin_username = ?');
    const row = rows?.[0];
    return row ? { adminId: row.admin_id, passwordHash: row.password_hash } : null;
  };
  Admin.findByPk = async () => {
    const [rows] = await queryMock('SELECT admin_id FROM admins WHERE admin_id = ?');
    return rows?.[0] || null;
  };
  Store.findOne = async () => {
    const [rows] = await queryMock('SELECT s.store_id, s.status, a.password_hash FROM stores s WHERE s.store_code = ?');
    const row = rows?.[0];
    return row ? toStore(row) : null;
  };
  Store.findByPk = async () => {
    const [rows] = await queryMock('SELECT store_id, store_name, store_code, status FROM stores s');
    return toStore(rows?.[0]);
  };
  Store.findAll = async () => {
    const [rows] = await queryMock('SELECT store_id, store_name, store_code, status, created_at FROM stores');
    return (rows || []).map(toStore);
  };
  Store.create = async (values, { transaction }) => {
    const [result] = await transaction.query('INSERT INTO stores (store_name, store_code, status) VALUES (?, ?, ?)');
    return toStore({ store_id: result.insertId, ...values });
  };
  StoreAccount.findByPk = async () => {
    const [rows] = await queryMock('SELECT password_hash FROM store_accounts WHERE account_id = ?');
    const row = rows?.[0];
    return row ? { passwordHash: row.password_hash, update: async () => {} } : null;
  };
  StoreAccount.create = async (values, { transaction }) => {
    await transaction.query('INSERT INTO store_accounts (store_id, password_hash, password_change_required) VALUES (?, ?, TRUE)');
    return values;
  };
};

const setQueryMock = (mock) => {
  queryMock = mock;
};

const setConnectionMock = (connection) => {
  sequelize.transaction = async (callback) => {
    const result = await callback(connection);
    await connection.commit();
    return result;
  };
};

installModelMocks();

module.exports = {
  app,
  adminToken,
  storeToken,
  setQueryMock,
  setConnectionMock,
};
