const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getAdminOrderDetail,
  getAdminOrders,
  updateOrderStatus,
  ORDER_STATUSES,
} = require('../services/orderService');

const router = express.Router();

router.use(authenticate, requireRole('ADMIN'));

const isValidId = (value) => /^\d+$/.test(value) && Number(value) > 0;

const serializeOrder = (order, stockIncreased) => ({
  order_id: order.orderId,
  store_id: order.storeId,
  product_id: order.productId,
  order_quantity: order.orderQuantity,
  order_status: order.orderStatus,
  created_at: order.createdAt,
  updated_at: order.updatedAt,
  ...(stockIncreased !== undefined ? { stock_increased: stockIncreased } : {}),
});

/**
 * @openapi
 * /api/admin/orders:
 *   get:
 *     tags:
 *       - Admin Orders
 *     summary: 전체 발주 목록 조회
 *     description: 관리자가 전체 점포의 발주 목록을 생성일 내림차순으로 조회합니다. store_id, status로 필터링할 수 있습니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: status
 *         required: false
 *         schema: { type: string, enum: [PENDING, ORDERED, COMPLETED, CANCELLED] }
 *     responses:
 *       '200': { description: 발주 목록 }
 *       '400': { description: 파라미터 형식이 올바르지 않습니다. }
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
 */
router.get('/', async (req, res, next) => {
  const { store_id: storeId, status } = req.query;

  if (storeId !== undefined && !isValidId(storeId)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'store_id는 1 이상의 정수여야 합니다.',
    });
  }
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'status는 PENDING, ORDERED, COMPLETED, CANCELLED 중 하나여야 합니다.',
    });
  }

  try {
    const orders = await getAdminOrders({
      storeId: storeId === undefined ? undefined : Number(storeId),
      status,
    });
    return res.json(orders);
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/admin/orders/{orderId}:
 *   get:
 *     tags:
 *       - Admin Orders
 *     summary: 발주 상세 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 발주 상세 }
 *       '404': { description: 발주를 찾을 수 없습니다. }
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
 */
router.get('/:orderId', async (req, res, next) => {
  const { orderId } = req.params;
  if (!isValidId(orderId)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'orderId는 1 이상의 정수여야 합니다.',
    });
  }

  try {
    const order = await getAdminOrderDetail(Number(orderId));
    return res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    return next(error);
  }
});

/**
 * @openapi
 * /api/admin/orders/{orderId}/status:
 *   patch:
 *     tags:
 *       - Admin Orders
 *     summary: 발주 상태 변경
 *     description: |
 *       발주 상태를 변경합니다. 허용 전이: PENDING→ORDERED/CANCELLED, ORDERED→COMPLETED/CANCELLED.
 *       COMPLETED(입고 완료)로 변경 시에만 해당 점포 재고가 발주 수량만큼 증가합니다(트랜잭션 처리).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [PENDING, ORDERED, COMPLETED, CANCELLED], example: ORDERED }
 *     responses:
 *       '200':
 *         description: 상태가 변경되었습니다. COMPLETED인 경우 stock_increased가 true입니다.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order_id: { type: integer, example: 1 }
 *                 order_status: { type: string, example: ORDERED }
 *                 stock_increased: { type: boolean, example: false }
 *       '400': { description: status 값이 올바르지 않습니다. }
 *       '404': { description: 발주를 찾을 수 없습니다. }
 *       '409': { description: 허용되지 않는 상태 전이입니다. }
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
 */
router.patch('/:orderId/status', async (req, res, next) => {
  const { orderId } = req.params;
  if (!isValidId(orderId)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'orderId는 1 이상의 정수여야 합니다.',
    });
  }

  const { status } = req.body || {};
  if (typeof status !== 'string' || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'status는 PENDING, ORDERED, COMPLETED, CANCELLED 중 하나여야 합니다.',
    });
  }

  try {
    const { order, stockIncreased } = await updateOrderStatus(Number(orderId), status);
    return res.json({
      ...serializeOrder(order, stockIncreased),
      product_name: order.product?.productName ?? null,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    return next(error);
  }
});

module.exports = router;
