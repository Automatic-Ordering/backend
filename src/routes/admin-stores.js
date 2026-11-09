const express = require('express');
const { pool } = require('../config/database');
const { hashPassword } = require('../utils/password');
const { generateStoreCode } = require('../utils/store-code');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('ADMIN'));

router.post('/', async (req, res, next) => {
  const { store_name: storeName, initial_password: initialPassword, password } = req.body || {};
  const storePassword = initialPassword || password;
  if (typeof storeName !== 'string' || !storeName.trim() || typeof storePassword !== 'string' || storePassword.length < 8) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'store_name is required and initial_password must be at least 8 characters.',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let storeCode;
    let result;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      storeCode = generateStoreCode();
      try {
        [result] = await connection.query(
          'INSERT INTO stores (store_name, store_code, status) VALUES (?, ?, ?)',
          [storeName.trim(), storeCode, 'ACTIVE'],
        );
        break;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY' || attempt === 4) throw error;
      }
    }
    await connection.query(
      'INSERT INTO store_accounts (store_id, password_hash, password_change_required) VALUES (?, ?, TRUE)',
      [result.insertId, await hashPassword(storePassword)],
    );
    await connection.commit();
    return res.status(201).json({
      store_id: result.insertId,
      store_name: storeName.trim(),
      store_code: storeCode,
      status: 'ACTIVE',
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT store_id, store_name, store_code, status, created_at
         FROM stores ORDER BY store_id DESC`,
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get('/:storeId', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT store_id, store_name, store_code, status, created_at, updated_at
         FROM stores WHERE store_id = ?`,
      [req.params.storeId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND', message: 'Store not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.patch('/:storeId', async (req, res, next) => {
  const { store_name: storeName } = req.body || {};
  if (typeof storeName !== 'string' || !storeName.trim()) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'store_name is required.' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE stores SET store_name = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ?',
      [storeName.trim(), req.params.storeId],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'NOT_FOUND', message: 'Store not found.' });
    return res.json({ store_id: Number(req.params.storeId), store_name: storeName.trim() });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:storeId/status', async (req, res, next) => {
  const { status } = req.body || {};
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'status must be ACTIVE or SUSPENDED.' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE stores SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE store_id = ?',
      [status, req.params.storeId],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'NOT_FOUND', message: 'Store not found.' });
    return res.json({ store_id: Number(req.params.storeId), status });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
