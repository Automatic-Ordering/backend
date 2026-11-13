const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  getOrderRecommendations,
  getRecommendationDetail,
  getStoreOrderDetail,
  getStoreOrders,
  confirmOrders,
  serializeOrderRow,
  ORDER_STATUSES,
} = require("../services/orderService");
const {
  parsePaginationParams,
  buildPaginatedResponse,
} = require("../utils/pagination");

const router = express.Router();

router.use(authenticate, requireRole("STORE"));

const isValidProductId = (value) => /^\d+$/.test(value) && Number(value) > 0;

const getConfirmInputError = (body) => {
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return "items는 1개 이상의 발주 항목 배열이어야 합니다.";
  }
  if (items.length > 500) {
    return "items는 한 번에 최대 500개까지 발주할 수 있습니다.";
  }
  return null;
};

/**
 * @openapi
 * /api/store/orders/recommendations:
 *   get:
 *     tags:
 *       - Store Orders
 *     summary: 자동 발주 추천 목록 조회
 *     description: 로그인된 점포에 등록된 상품별로 수요 예측(최근 7일 이동평균 0.4 + 동일 요일 평균 0.6), 안전재고, 목표재고, 추천 발주량을 계산해 반환합니다. page/limit으로 페이지네이션되며, search로 상품명·카테고리를 필터링합니다. 판매 데이터 부족 시 data_warning에 경고 코드를 포함합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: false
 *         description: 상품명 또는 카테고리 부분 일치 검색어
 *         schema: { type: string, example: 도시락 }
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호 (기본 1)
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 페이지당 건수 (기본 20, 최대 100)
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200':
 *         description: 상품별 발주 추천 페이지
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
 *                       product_id: { type: integer, example: 1 }
 *                       product_name: { type: string, example: 참치마요 삼각김밥 }
 *                       category: { type: string, example: '삼각김밥 / 샌드위치' }
 *                       current_stock: { type: integer, example: 3 }
 *                       incoming_quantity: { type: integer, description: 입고 예정 수량 (PENDING/ORDERED 발주 합계), example: 0 }
 *                       predicted_demand: { type: number, description: 다음 날 예상 판매량, example: 8.2 }
 *                       moving_average: { type: number, example: 10 }
 *                       same_weekday_average: { type: number, nullable: true, example: 7 }
 *                       daily_std_dev: { type: number, description: 일일 판매량 표본 표준편차, example: 2.44 }
 *                       sales_series_days: { type: integer, description: 계산에 사용된 판매 데이터 일수, example: 120 }
 *                       service_level_z: { type: number, example: 1.65 }
 *                       lead_time_days: { type: integer, example: 2 }
 *                       order_unit: { type: integer, example: 5 }
 *                       computed_safety_stock: { type: integer, description: 자동 계산 안전재고, example: 4 }
 *                       configured_safety_stock: { type: integer, nullable: true, description: 점포 설정 안전재고 (0이면 null), example: 6 }
 *                       applied_safety_stock: { type: integer, example: 6 }
 *                       safety_stock_source: { type: string, enum: [CONFIGURED, AUTO_CALCULATED], example: CONFIGURED }
 *                       target_stock: { type: integer, description: 목표재고, example: 14 }
 *                       raw_order_quantity: { type: integer, example: 11 }
 *                       order_quantity: { type: integer, description: 추천 발주량 (발주 단위 배수 올림), example: 15 }
 *                       needs_order: { type: boolean, example: true }
 *                       data_warning: { type: array, items: { type: string }, example: [] }
 *                 total: { type: integer, description: 검색 조건의 전체 상품 수, example: 100 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 20 }
 *                 total_pages: { type: integer, example: 5 }
 *       '400': { description: page/limit 값이 올바르지 않습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/recommendations", async (req, res, next) => {
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
      : undefined;

  try {
    const { recommendations, total } = await getOrderRecommendations(
      req.user.storeId,
      {
        page: pagination.page,
        limit: pagination.limit,
        search,
      },
    );
    return res.json(
      buildPaginatedResponse(
        recommendations,
        total,
        pagination.page,
        pagination.limit,
      ),
    );
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/store/orders/recommendations/{productId}:
 *   get:
 *     tags:
 *       - Store Orders
 *     summary: 발주 추천 상세 조회
 *     description: 상품 하나의 계산 근거(판매 데이터 요약, 최근 14일 일별 판매량, 표본 수)를 포함해 반환합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 발주 추천 상세 }
 *       '400': { description: 상품 ID 형식이 올바르지 않습니다. }
 *       '404': { description: 해당 점포 재고에 등록되지 않은 상품입니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/recommendations/:productId", async (req, res, next) => {
  const { productId } = req.params;
  if (!isValidProductId(productId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "productId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const detail = await getRecommendationDetail(
      req.user.storeId,
      Number(productId),
    );
    return res.json(detail);
  } catch (error) {
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({ error: error.code, message: error.message });
    }
    return next(error);
  }
});

/**
 * @openapi
 * /api/store/orders/confirm:
 *   post:
 *     tags:
 *       - Store Orders
 *     summary: 발주 확정
 *     description: 사용자가 수정한 발주 수량을 반영해 발주를 생성합니다. 생성된 발주는 PENDING(발주 대기) 상태이며, 입고 완료(COMPLETED) 처리 시에만 재고가 증가합니다. 요청 본문의 점포 ID는 신뢰하지 않고 인증 토큰의 점포 ID를 사용합니다.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [product_id, quantity]
 *                   properties:
 *                     product_id: { type: integer, minimum: 1, example: 1 }
 *                     quantity: { type: integer, minimum: 1, example: 10 }
 *     responses:
 *       '201':
 *         description: 발주가 생성되었습니다 (상태 PENDING).
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   order_id: { type: integer, example: 1 }
 *                   store_id: { type: integer, example: 10 }
 *                   product_id: { type: integer, example: 1 }
 *                   order_quantity: { type: integer, example: 10 }
 *                   order_status: { type: string, enum: [PENDING, ORDERED, COMPLETED, CANCELLED], example: PENDING }
 *                   created_at: { type: string, format: date-time }
 *                   updated_at: { type: string, format: date-time }
 *       '400': { description: 입력값이 올바르지 않습니다. }
 *       '404': { description: 해당 점포 재고에 등록되지 않은 상품이 포함되어 있습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.post("/confirm", async (req, res, next) => {
  const inputError = getConfirmInputError(req.body);
  if (inputError) {
    return res
      .status(400)
      .json({ error: "INVALID_INPUT", message: inputError });
  }

  try {
    const orders = await confirmOrders(req.user.storeId, req.body.items);
    return res.status(201).json(
      orders.map((order) => ({
        order_id: order.orderId,
        store_id: order.storeId,
        product_id: order.productId,
        order_quantity: order.orderQuantity,
        order_status: order.orderStatus,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      })),
    );
  } catch (error) {
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({ error: error.code, message: error.message });
    }
    return next(error);
  }
});

/**
 * @openapi
 * /api/store/orders:
 *   get:
 *     tags:
 *       - Store Orders
 *     summary: 발주 이력 조회
 *     description: 로그인된 점포의 발주 내역을 생성일 내림차순으로 조회합니다. status로 상태를 필터링하고 page/limit으로 페이지네이션합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema: { type: string, enum: [PENDING, ORDERED, COMPLETED, CANCELLED] }
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호 (기본 1)
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 페이지당 건수 (기본 20, 최대 100)
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200':
 *         description: 발주 이력 페이지
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
 *                       order_id: { type: integer, example: 1 }
 *                       store_id: { type: integer, example: 10 }
 *                       product_id: { type: integer, example: 9 }
 *                       product_name: { type: string, example: '11가지찬 도시락' }
 *                       category: { type: string, example: '도시락 / 김밥' }
 *                       order_quantity: { type: integer, example: 14 }
 *                       order_status: { type: string, enum: [PENDING, ORDERED, COMPLETED, CANCELLED], example: PENDING }
 *                       created_at: { type: string, format: date-time }
 *                       updated_at: { type: string, format: date-time }
 *                 total: { type: integer, example: 35 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 20 }
 *                 total_pages: { type: integer, example: 2 }
 *       '400': { description: status 또는 page/limit 값이 올바르지 않습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/", async (req, res, next) => {
  const { status } = req.query;
  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message:
        "status는 PENDING, ORDERED, COMPLETED, CANCELLED 중 하나여야 합니다.",
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
    const { orders, total } = await getStoreOrders(req.user.storeId, {
      status,
      page: pagination.page,
      limit: pagination.limit,
    });
    return res.json(
      buildPaginatedResponse(
        orders.map(serializeOrderRow),
        total,
        pagination.page,
        pagination.limit,
      ),
    );
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/store/orders/{orderId}:
 *   get:
 *     tags:
 *       - Store Orders
 *     summary: 발주 상세 조회
 *     description: 점포 소유권을 검증해 자신의 발주만 상세 조회합니다.
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
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/:orderId", async (req, res, next) => {
  const { orderId } = req.params;
  if (!isValidProductId(orderId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "orderId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const order = await getStoreOrderDetail(req.user.storeId, Number(orderId));
    return res.json(order);
  } catch (error) {
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({ error: error.code, message: error.message });
    }
    return next(error);
  }
});

module.exports = router;
