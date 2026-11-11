const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { verifyPassword } = require('../utils/password');
const { getJwtSecret } = require('../middleware/auth');

const router = express.Router();

/**
 * @openapi
 * /api/admin/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: 관리자 로그인
 *     description: 관리자 아이디와 비밀번호로 로그인하고 JWT를 발급합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admin_username
 *               - password
 *             properties:
 *               admin_username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: AdminPass123!
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
 *         description: 관리자 아이디 또는 비밀번호가 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req, res, next) => {
  const { admin_username: username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: '관리자 아이디와 비밀번호는 필수입니다.' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT admin_id, password_hash FROM admins WHERE admin_username = ?',
      [username.trim()],
    );
    const admin = rows[0];
    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    return res.json({
      token: jwt.sign({ adminId: admin.admin_id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '8h' }),
      token_type: 'Bearer',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
