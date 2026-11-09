const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const { pool } = require('../../src/config/database');

const adminToken = () => jwt.sign({ adminId: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
const storeToken = () => jwt.sign({ storeId: 1, role: 'STORE' }, process.env.JWT_SECRET);

const setQueryMock = (queryMock) => {
  pool.query = queryMock;
};

const setConnectionMock = (connection) => {
  pool.getConnection = async () => connection;
};

module.exports = {
  app,
  adminToken,
  storeToken,
  setQueryMock,
  setConnectionMock,
};
