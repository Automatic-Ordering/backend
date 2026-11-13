const express = require("express");
const { sequelize } = require("../../config/database");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  parsePaginationParams,
  buildPaginatedResponse,
} = require("../utils/pagination");

const router = express.Router();

router.use(authenticate, requireRole("STORE"));

const serializeStoreProductRow = (row) => ({
  product_id: row.product_id,
  product_name: row.product_name,
  category: row.category,
  price: Number(row.price),
  is_registered: Boolean(row.is_registered),
  current_stock: row.current_stock === null ? null : Number(row.current_stock),
  safety_stock: row.safety_stock === null ? null : Number(row.safety_stock),
});

const STORE_PRODUCT_SELECT = `
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
`;

/**
 * @openapi
 * /api/store/products:
 *   get:
 *     tags:
 *       - Store Products
 *     summary: 점포 상품 및 재고 목록 조회
 *     description: 본사 전체 상품 카탈로그와 현재 로그인된 점포의 등록 여부 및 재고 현황(현재 재고, 안전 재고)을 조회합니다. page/limit 파라미터를 지정하면 등록된 상품만 페이지 단위로 반환하며(검색어 지정 가능), 지정하지 않으면 전체 목록을 배열로 반환합니다(기존 동작 유지).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         description: 상품명 또는 카테고리 부분 일치 검색어 (페이지네이션 모드에서만 동작)
 *         schema: { type: string, example: 도시락 }
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호 (기본 1). 지정 시 등록 상품만 페이지네이션합니다.
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 페이지당 건수 (기본 20, 최대 100)
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200':
 *         description: 본사 상품 및 현재 점포의 재고 목록. page/limit 지정 시 { items, total, page, limit, total_pages } 래퍼, 미지정 시 전체 배열.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     $ref: '#/components/schemas/StoreProduct'
 *                 - type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StoreProduct'
 *                     total: { type: integer, example: 100 }
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 20 }
 *                     total_pages: { type: integer, example: 5 }
 *       '400': { description: page/limit 값이 올바르지 않습니다. }
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
router.get("/", async (req, res, next) => {
  const wantsPagination =
    req.query.page !== undefined || req.query.limit !== undefined;

  if (wantsPagination) {
    let pagination;
    try {
      pagination = parsePaginationParams(req.query);
    } catch (error) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: error.message,
      });
    }

    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : null;
    const searchClause = search
      ? "AND (p.product_name LIKE :search OR p.category LIKE :search)"
      : "";
    const replacements = { storeId: req.user.storeId };
    if (search) {
      replacements.search = `%${search}%`;
    }

    try {
      const [[{ total }]] = await sequelize.query(
        `
          SELECT COUNT(*) AS total
          FROM products p
          LEFT JOIN store_inventories si
            ON p.product_id = si.product_id
            AND si.store_id = :storeId
          WHERE si.inventory_id IS NOT NULL ${searchClause}
        `,
        { replacements },
      );
      const [rows] = await sequelize.query(
        `
          ${STORE_PRODUCT_SELECT}
          WHERE si.inventory_id IS NOT NULL ${searchClause}
          ORDER BY p.product_id DESC
          LIMIT :limit OFFSET :offset
        `,
        {
          replacements: {
            ...replacements,
            limit: pagination.limit,
            offset: (pagination.page - 1) * pagination.limit,
          },
        },
      );

      return res.json(
        buildPaginatedResponse(
          rows.map((row) => serializeStoreProductRow(row)),
          Number(total),
          pagination.page,
          pagination.limit,
        ),
      );
    } catch (error) {
      return next(error);
    }
  }

  try {
    const [rows] = await sequelize.query(
      `${STORE_PRODUCT_SELECT} ORDER BY p.product_id DESC`,
      {
        replacements: { storeId: req.user.storeId },
      },
    );

    return res.json(rows.map((row) => serializeStoreProductRow(row)));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
