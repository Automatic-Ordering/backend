const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required.');
  }
  return process.env.JWT_SECRET;
};

const authenticate = async (req, res, next) => {
  const authorization = req.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer token is required.' });
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer token is required.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token.' });
  }

  try {
    if (payload.role === 'ADMIN' && Number.isInteger(payload.adminId)) {
      const [rows] = await pool.query(
        'SELECT admin_id FROM admins WHERE admin_id = ?',
        [payload.adminId],
      );
      if (rows.length === 1) {
        req.user = { adminId: payload.adminId, role: 'ADMIN' };
        return next();
      }
    }

    if (payload.role === 'STORE' && Number.isInteger(payload.storeId)) {
      const [rows] = await pool.query(
        `SELECT s.store_id, s.store_code, s.store_name, s.status,
                a.account_id, a.password_change_required
           FROM stores s
           JOIN store_accounts a ON a.store_id = s.store_id
          WHERE s.store_id = ?`,
        [payload.storeId],
      );
      const store = rows[0];
      if (store && store.status === 'ACTIVE') {
        req.user = {
          storeId: store.store_id,
          storeCode: store.store_code,
          storeName: store.store_name,
          status: store.status,
          accountId: store.account_id,
          passwordChangeRequired: Boolean(store.password_change_required),
          role: 'STORE',
        };
        return next();
      }
    }

    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication is no longer valid.' });
  } catch (error) {
    return next(error);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions.' });
  }
  return next();
};

const rejectPasswordChangeRequired = (req, res, next) => {
  if (req.user?.role === 'STORE' && req.user.passwordChangeRequired) {
    return res.status(403).json({
      error: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Change the initial password before using this API.',
    });
  }
  return next();
};

module.exports = { authenticate, requireRole, rejectPasswordChangeRequired, getJwtSecret };
