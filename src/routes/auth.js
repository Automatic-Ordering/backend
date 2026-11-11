const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/password');
const { authenticate, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

const issueStoreToken = (storeId) => jwt.sign({ storeId, role: 'STORE' }, getJwtSecret(), { expiresIn: '8h' });

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: 점포 로그인
 *     description: 활성 상태인 점포의 점포 코드와 비밀번호로 로그인하고 JWT를 발급합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - store_code
 *               - password
 *             properties:
 *               store_code:
 *                 type: string
 *                 example: 12345
 *               password:
 *                 type: string
 *                 format: password
 *                 example: StorePass123!
 *     responses:
 *       '200':
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       '400':
 *         description: 필수 입력값이 없거나 형식이 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 점포 코드 또는 비밀번호가 올바르지 않거나 점포가 비활성 상태입니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req, res, next) => {
  const { store_code: storeCode, password } = req.body || {};
  if (typeof storeCode !== 'string' || typeof password !== 'string' || !storeCode.trim() || !password) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: '점포 코드와 비밀번호는 필수입니다.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT s.store_id, s.status, a.password_hash
         FROM stores s JOIN store_accounts a ON a.store_id = s.store_id
        WHERE s.store_code = ?`,
      [storeCode.trim()],
    );
    const store = rows[0];
    if (!store || store.status !== 'ACTIVE' || !(await verifyPassword(password, store.password_hash))) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '점포 코드 또는 비밀번호가 올바르지 않습니다.' });
    }
    return res.json({ token: issueStoreToken(store.store_id), token_type: 'Bearer' });
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: 현재 점포 정보 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 인증된 점포 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [storeId, storeCode, storeName, role, status, passwordChangeRequired]
 *               properties:
 *                 storeId:
 *                   type: integer
 *                   example: 1
 *                 storeCode:
 *                   type: string
 *                   example: 12345
 *                 storeName:
 *                   type: string
 *                   example: 테스트 점포
 *                 role:
 *                   type: string
 *                   enum: [STORE]
 *                 status:
 *                   type: string
 *                   enum: [ACTIVE]
 *                 passwordChangeRequired:
 *                   type: boolean
 *                   example: true
 *       '401':
 *         description: Bearer 토큰이 없거나 유효하지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 점포 인증이 필요합니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', authenticate, (req, res) => {
  if (req.user.role !== 'STORE') {
    return res.status(403).json({ error: 'FORBIDDEN', message: '점포 인증이 필요합니다.' });
  }
  return res.json({
    storeId: req.user.storeId,
    storeCode: req.user.storeCode,
    storeName: req.user.storeName,
    role: req.user.role,
    status: req.user.status,
    passwordChangeRequired: req.user.passwordChangeRequired,
  });
});

/**
 * @openapi
 * /api/auth/password:
 *   patch:
 *     tags:
 *       - Authentication
 *     summary: 점포 비밀번호 변경
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *                 format: password
 *                 example: InitialPass123!
 *               new_password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewStorePass123!
 *     responses:
 *       '200':
 *         description: 비밀번호 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message]
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password changed successfully.
 *       '400':
 *         description: 입력값이 없거나 새 비밀번호가 8자 미만입니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 토큰 또는 현재 비밀번호가 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 점포 인증이 필요합니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/password', authenticate, async (req, res, next) => {
  if (req.user.role !== 'STORE') {
    return res.status(403).json({ error: 'FORBIDDEN', message: '점포 인증이 필요합니다.' });
  }
  const { current_password: currentPassword, new_password: newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: '현재 비밀번호는 필수이며 새 비밀번호는 8자 이상이어야 합니다.',
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT password_hash FROM store_accounts WHERE account_id = ?',
      [req.user.accountId],
    );
    if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '현재 비밀번호가 올바르지 않습니다.' });
    }
    await pool.query(
      `UPDATE store_accounts
          SET password_hash = ?, password_change_required = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?`,
      [await hashPassword(newPassword), req.user.accountId],
    );
    return res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
