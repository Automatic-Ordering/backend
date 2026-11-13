const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { registerSale, getSalesHistory } = require("../services/salesService");
const {
  parsePaginationParams,
  buildPaginatedResponse,
} = require("../utils/pagination");

const router = express.Router();

router.use(authenticate, requireRole("STORE"));

const getValidationError = ({
  product_id: productId,
  sales_quantity: salesQuantity,
  sales_date: salesDate,
}) => {
  const parsedProductId = Number(productId);
  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return "product_id는 1 이상의 정수여야 합니다.";
  }

  const parsedQuantity = Number(salesQuantity);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
    return "sales_quantity는 1 이상의 정수여야 합니다.";
  }

  if (
    typeof salesDate !== "string" ||
    !salesDate.trim() ||
    Number.isNaN(new Date(salesDate).getTime())
  ) {
    return "sales_date는 유효한 날짜 문자열이어야 합니다.";
  }

  return null;
};

const serializeSale = (sale, remainingStock) => ({
  sales_id: sale.salesId,
  store_id: sale.storeId,
  product_id: sale.productId,
  sales_quantity: sale.salesQuantity,
  sales_date: sale.salesDate,
  remaining_stock: remainingStock,
});

/**
 * @openapi
 * /api/store/sales:
 *   post:
 *     tags:
 *       - Store Sales
 *     summary: 점포 판매 등록
 *     description: 로그인된 점포의 판매를 등록하고 해당 상품의 현재 재고를 차감합니다. 판매 등록과 재고 차감은 하나의 트랜잭션으로 처리되며, 재고 행에 배타적 잠금(FOR UPDATE)을 걸어 동시 판매에 따른 재고 초과 차감을 방지합니다.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_id
 *               - sales_quantity
 *               - sales_date
 *             properties:
 *               product_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 1
 *               sales_quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *               sales_date:
 *                 type: string
 *                 format: date-time
 *                 description: 판매 시각 (미래 시각은 허용되지 않음)
 *                 example: '2026-11-13T10:30:00.000Z'
 *     responses:
 *       '201':
 *         description: 판매가 등록되고 재고가 차감되었습니다.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sales_id:
 *                   type: integer
 *                   example: 101
 *                 store_id:
 *                   type: integer
 *                   example: 1
 *                 product_id:
 *                   type: integer
 *                   example: 1
 *                 sales_quantity:
 *                   type: integer
 *                   example: 2
 *                 sales_date:
 *                   type: string
 *                   format: date-time
 *                   example: '2026-11-13T10:30:00.000Z'
 *                 remaining_stock:
 *                   type: integer
 *                   description: 차감 후 남은 재고
 *                   example: 3
 *       '400':
 *         description: 입력값이 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *       '404':
 *         description: 해당 점포에 등록되지 않은 상품입니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: 재고가 부족하여 판매를 등록할 수 없습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req, res, next) => {
  const body = req.body || {};

  const validationMessage = getValidationError(body);
  if (validationMessage) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: validationMessage,
    });
  }

  const salesDate = new Date(body.sales_date);
  if (salesDate.getTime() > Date.now()) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "sales_date는 미래 시각일 수 없습니다.",
    });
  }

  try {
    const { sale, remainingStock } = await registerSale({
      storeId: req.user.storeId,
      productId: Number(body.product_id),
      salesQuantity: Number(body.sales_quantity),
      salesDate,
    });

    return res.status(201).json(serializeSale(sale, remainingStock));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
      });
    }
    return next(error);
  }
});

const isValidDateParam = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const serializeSaleRow = (sale) => ({
  sales_id: sale.salesId,
  product_id: sale.productId,
  product_name: sale.product?.productName ?? null,
  category: sale.product?.category ?? null,
  sales_quantity: sale.salesQuantity,
  sales_date: sale.salesDate,
});

/**
 * @openapi
 * /api/store/sales:
 *   get:
 *     tags:
 *       - Store Sales
 *     summary: 점포 판매 내역 조회
 *     description: 로그인된 점포의 판매 내역을 판매일 내림차순으로 조회합니다. from, to(YYYY-MM-DD)로 기간을 필터링할 수 있으며, page/limit으로 페이지네이션됩니다. 상품 정보는 본사 Product 카탈로그에서 함께 조회됩니다. 다른 점포의 데이터는 조회되지 않습니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         description: 조회 시작일 (해당 날짜 00:00:00부터 포함)
 *         schema:
 *           type: string
 *           format: date
 *           example: '2026-11-01'
 *       - in: query
 *         name: to
 *         required: false
 *         description: 조회 종료일 (해당 날짜 23:59:59까지 포함)
 *         schema:
 *           type: string
 *           format: date
 *           example: '2026-11-07'
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호 (기본 1)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 페이지당 건수 (기본 20, 최대 100)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       '200':
 *         description: 판매 내역 페이지 (판매일 내림차순)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sales_id: { type: integer, example: 101 }
 *                       product_id: { type: integer, example: 2 }
 *                       product_name: { type: string, nullable: true, example: 참치마요 삼각김밥 }
 *                       category: { type: string, nullable: true, example: '삼각김밥 / 샌드위치' }
 *                       sales_quantity: { type: integer, example: 2 }
 *                       sales_date: { type: string, format: date-time, example: '2026-11-12T10:30:00.000Z' }
 *                 total: { type: integer, description: 필터 조건의 전체 건수, example: 1200 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 20 }
 *                 total_pages: { type: integer, example: 60 }
 *       '400':
 *         description: from/to 날짜 형식 또는 page/limit 값이 올바르지 않습니다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
  const { from, to } = req.query;

  if (from !== undefined && !isValidDateParam(from)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "from 날짜는 YYYY-MM-DD 형식이어야 합니다.",
    });
  }

  if (to !== undefined && !isValidDateParam(to)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "to 날짜는 YYYY-MM-DD 형식이어야 합니다.",
    });
  }

  if (from !== undefined && to !== undefined && from > to) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "from 날짜는 to 날짜보다 이후일 수 없습니다.",
    });
  }

  let pagination;
  try {
    pagination = parsePaginationParams(req.query);
  } catch (error) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: error.message,
    });
  }

  try {
    const { sales, total } = await getSalesHistory({
      storeId: req.user.storeId,
      from,
      to,
      page: pagination.page,
      limit: pagination.limit,
    });

    return res.json(
      buildPaginatedResponse(
        sales.map(serializeSaleRow),
        total,
        pagination.page,
        pagination.limit,
      ),
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
