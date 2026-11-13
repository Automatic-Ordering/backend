const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  SPEC_STATUSES,
  createOrderSpec,
  updateOrderSpecItems,
  submitOrderSpec,
  cancelOrderSpec,
  receiveOrderSpec,
  getOrderSpecs,
  getOrderSpecDetail,
  serializeSpec,
} = require("../services/orderSpecService");
const {
  parsePaginationParams,
  buildPaginatedResponse,
} = require("../utils/pagination");

const router = express.Router();

router.use(authenticate, requireRole("STORE"));

const isValidId = (value) => /^\d+$/.test(value) && Number(value) > 0;

const handleServiceError = (res, next, error) => {
  if (error.statusCode) {
    return res
      .status(error.statusCode)
      .json({ error: error.code, message: error.message });
  }
  return next(error);
};

const getItemsInputError = (body, required) => {
  const items = body?.items;
  if (required && items === undefined) {
    return "items는 1개 이상의 발주 항목 배열이어야 합니다.";
  }
  if (items !== undefined && items !== null && !Array.isArray(items)) {
    return "items는 배열이어야 합니다.";
  }
  return null;
};

/**
 * @openapi
 * /api/store/orders/specs:
 *   post:
 *     tags:
 *       - Store Order Specs
 *     summary: 발주 명세서 생성 (DRAFT)
 *     description: |
 *       발주 명세서를 DRAFT 상태로 생성합니다. items를 생략하면 자동 발주 추천(needs_order) 결과가 기반으로 사용됩니다.
 *       상품명·단가는 서버가 스냅샷으로 저장하고 금액과 총 발주 금액은 서버가 계산합니다. 발주 번호는 자동 생성됩니다(OS-YYYYMMDD-XXXXXX).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 description: 생략 시 자동 발주 추천 결과 사용
 *                 items:
 *                   type: object
 *                   required: [product_id, quantity]
 *                   properties:
 *                     product_id: { type: integer, minimum: 1, example: 1 }
 *                     quantity: { type: integer, minimum: 1, example: 10 }
 *     responses:
 *       '201':
 *         description: DRAFT 발주 명세서가 생성되었습니다.
 *       '400': { description: 입력값이 올바르거나 발주 대상 상품이 없습니다. }
 *       '404': { description: 해당 점포 재고에 등록되지 않은 상품이 포함되어 있습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.post("/", async (req, res, next) => {
  const inputError = getItemsInputError(req.body, false);
  if (inputError) {
    return res.status(400).json({ error: "INVALID_INPUT", message: inputError });
  }

  try {
    const spec = await createOrderSpec(req.user.storeId, {
      items: req.body?.items,
    });
    return res.status(201).json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/orders/specs:
 *   get:
 *     tags:
 *       - Store Order Specs
 *     summary: 발주 명세서 목록 조회
 *     description: 로그인된 점포의 발주 명세서 목록을 생성일 내림차순으로 조회합니다. status로 상태를 필터링하고 page/limit으로 페이지네이션합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema: { type: string, enum: [DRAFT, REQUESTED, APPROVED, REJECTED, ORDERED, RECEIVED, CANCELLED] }
 *       - in: query
 *         name: page
 *         required: false
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200': { description: 발주 명세서 페이지 }
 *       '400': { description: status 또는 page/limit 값이 올바르지 않습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/", async (req, res, next) => {
  const { status } = req.query;
  if (status !== undefined && !SPEC_STATUSES.includes(status)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message:
        "status는 DRAFT, REQUESTED, APPROVED, REJECTED, ORDERED, RECEIVED, CANCELLED 중 하나여야 합니다.",
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
    const { specs, total } = await getOrderSpecs(req.user.storeId, {
      status,
      page: pagination.page,
      limit: pagination.limit,
    });
    return res.json(
      buildPaginatedResponse(
        specs.map((spec) => serializeSpec(spec)),
        total,
        pagination.page,
        pagination.limit,
      ),
    );
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/orders/specs/pending-receipts:
 *   get:
 *     tags:
 *       - Store Order Specs
 *     summary: 입고 대기 발주 목록 조회
 *     description: 발주서 발행이 완료된(ORDERED) 입고 대기 명세서 목록을 조회합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200': { description: 입고 대기 발주 페이지 }
 *       '400': { description: page/limit 값이 올바르지 않습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/pending-receipts", async (req, res, next) => {
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
    const { specs, total } = await getOrderSpecs(req.user.storeId, {
      status: "ORDERED",
      page: pagination.page,
      limit: pagination.limit,
    });
    return res.json(
      buildPaginatedResponse(
        specs.map((spec) => serializeSpec(spec)),
        total,
        pagination.page,
        pagination.limit,
      ),
    );
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/orders/specs/{specId}:
 *   get:
 *     tags:
 *       - Store Order Specs
 *     summary: 발주 명세서 상세 조회
 *     description: 점포 소유권을 검증해 자신의 명세서만 상세 조회합니다. 상품 목록과 상태 변경 이력을 포함합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 발주 명세서 상세 }
 *       '404': { description: 발주 명세서를 찾을 수 없습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/:specId", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const spec = await getOrderSpecDetail(req.user.storeId, Number(specId));
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/orders/specs/{specId}/items:
 *   patch:
 *     tags:
 *       - Store Order Specs
 *     summary: 발주 수량 수정 (DRAFT 전용)
 *     description: |
 *       제출 전(DRAFT) 명세서의 상품과 수량을 전체 교체 방식으로 수정합니다.
 *       제출(REQUESTED) 이후에는 변경할 수 없으며 409를 반환합니다. 금액과 총액은 서버가 재계산합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
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
 *                     quantity: { type: integer, minimum: 1, example: 7 }
 *     responses:
 *       '200': { description: 수정된 발주 명세서 }
 *       '400': { description: 입력값이 올바르지 않습니다. }
 *       '404': { description: 발주 명세서를 찾을 수 없거나 등록되지 않은 상품이 있습니다. }
 *       '409': { description: 제출 이후에는 수정할 수 없습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.patch("/:specId/items", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  const inputError = getItemsInputError(req.body, true);
  if (inputError) {
    return res.status(400).json({ error: "INVALID_INPUT", message: inputError });
  }

  try {
    const spec = await updateOrderSpecItems(
      req.user.storeId,
      Number(specId),
      req.body.items,
    );
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/orders/specs/{specId}/submit:
 *   post:
 *     tags:
 *       - Store Order Specs
 *     summary: 발주 명세서 제출
 *     description: DRAFT 명세서를 REQUESTED(승인 대기) 상태로 제출하고 발주 요청일을 기록합니다. 제출 이후에는 상품과 수량을 변경할 수 없습니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 제출 완료 (REQUESTED) }
 *       '400': { description: 발주 항목이 없습니다. }
 *       '404': { description: 발주 명세서를 찾을 수 없습니다. }
 *       '409': { description: 허용되지 않는 상태 전이입니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.post("/:specId/submit", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const spec = await submitOrderSpec(req.user.storeId, Number(specId));
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/orders/specs/{specId}/cancel:
 *   post:
 *     tags:
 *       - Store Order Specs
 *     summary: 발주 명세서 취소
 *     description: DRAFT 또는 REQUESTED 상태의 명세서를 CANCELLED 상태로 변경합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 취소 완료 (CANCELLED) }
 *       '404': { description: 발주 명세서를 찾을 수 없습니다. }
 *       '409': { description: 허용되지 않는 상태 전이입니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.post("/:specId/cancel", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const spec = await cancelOrderSpec(req.user.storeId, Number(specId));
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/orders/specs/{specId}/receipt:
 *   post:
 *     tags:
 *       - Store Order Specs
 *     summary: 입고 처리
 *     description: |
 *       발주서 발행 완료(ORDERED) 명세서의 실제 입고 수량을 입력해 입고를 완료(RECEIVED) 처리합니다.
 *       처리 시 트랜잭션으로 점포 재고(StoreInventory)가 실제 입고 수량만큼 증가하며, 주문 수량과 입고 수량 비교 결과를 반환합니다.
 *       중복 입고는 차단됩니다. 명세서의 모든 상품에 대한 입고 수량 입력이 필요합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
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
 *                   required: [product_id, received_quantity]
 *                   properties:
 *                     product_id: { type: integer, minimum: 1, example: 1 }
 *                     received_quantity: { type: integer, minimum: 0, example: 8 }
 *     responses:
 *       '200':
 *         description: 입고 완료 (RECEIVED). comparison에 주문/입고 수량 비교가 포함됩니다.
 *       '400': { description: 입력값이 올바르지 않거나 입고 수량이 누락되었습니다. }
 *       '404': { description: 발주 명세서를 찾을 수 없습니다. }
 *       '409': { description: 중복 입고이거나 허용되지 않는 상태 전이입니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.post("/:specId/receipt", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  const inputError = getItemsInputError(req.body, true);
  if (inputError) {
    return res.status(400).json({ error: "INVALID_INPUT", message: inputError });
  }

  try {
    const result = await receiveOrderSpec(
      req.user.storeId,
      Number(specId),
      req.body.items,
    );
    return res.json(result);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

module.exports = router;
