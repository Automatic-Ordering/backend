const express = require('express');
const { sequelize } = require('../../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('STORE'));

/**
 * @openapi
 * /api/store/products:
 *   get:
 *     tags:
 *       - Store Products
 *     summary: 점포 상품 및 재고 목록 조회
 *     description: 본사 전체 상품 카탈로그와 현재 로그인된 점포의 등록 여부 및 재고 현황(현재 재고, 안전 재고)을 조회합니다.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 본사 상품 및 현재 점포의 재고 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StoreProduct'
 *       '401':
 *         description: 점포 인증이 필요합니다 (토큰 누락 또는 유효하지 않음).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 점포 권한이 필요합니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await sequelize.query(
      `
        SELECT
          p.product_id,
          p.product_name,
          p.category,
          p.price,
          CASE WHEN si.inventory_id IS NULL THEN FALSE ELSE TRUE END AS is_registered,
          si.current_stock,
          si.safety_stock
        FROM products p
        LEFT JOIN store_inventories si
          ON p.product_id = si.product_id
          AND si.store_id = :storeId
        ORDER BY p.product_id DESC
      `,
      {
        replacements: { storeId: req.user.storeId },
      },
    );

    return res.json(
      rows.map((row) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        category: row.category,
        price: Number(row.price),
        is_registered: Boolean(row.is_registered),
        current_stock: row.current_stock === null ? null : Number(row.current_stock),
        safety_stock: row.safety_stock === null ? null : Number(row.safety_stock),
      })),
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
