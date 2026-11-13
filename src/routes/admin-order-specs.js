const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  SPEC_STATUSES,
  approveOrderSpec,
  rejectOrderSpec,
  issueOrderSpec,
  getAdminOrderSpecs,
  getAdminOrderSpecDetail,
  serializeSpec,
} = require("../services/orderSpecService");
const {
  parsePaginationParams,
  buildPaginatedResponse,
} = require("../utils/pagination");

const router = express.Router();

router.use(authenticate, requireRole("ADMIN"));

const isValidId = (value) => /^\d+$/.test(value) && Number(value) > 0;

const handleServiceError = (res, next, error) => {
  if (error.statusCode) {
    return res
      .status(error.statusCode)
      .json({ error: error.code, message: error.message });
  }
  return next(error);
};

/**
 * @openapi
 * /api/admin/orders/specs:
 *   get:
 *     tags:
 *       - Admin Order Specs
 *     summary: 전체 점포 발주 명세서 목록 조회
 *     description: 관리자가 전체 점포의 발주 명세서 목록을 생성일 내림차순으로 조회합니다. store_id, status로 필터링할 수 있습니다.
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
 *       '200': { description: 발주 명세서 목록 }
 *       '400': { description: 파라미터 형식이 올바르지 않습니다. }
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
 */
router.get("/", async (req, res, next) => {
  const { store_id: storeId, status } = req.query;

  if (storeId !== undefined && !isValidId(storeId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "store_id는 1 이상의 정수여야 합니다.",
    });
  }
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
    const { specs, total } = await getAdminOrderSpecs({
      storeId: storeId === undefined ? undefined : Number(storeId),
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
 * /api/admin/orders/specs/{specId}:
 *   get:
 *     tags:
 *       - Admin Order Specs
 *     summary: 발주 명세서 상세 조회
 *     description: 상품 목록과 상태 변경 이력을 포함해 발주 명세서를 상세 조회합니다.
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
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
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
    const spec = await getAdminOrderSpecDetail(Number(specId));
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/admin/orders/specs/{specId}/approve:
 *   post:
 *     tags:
 *       - Admin Order Specs
 *     summary: 발주 승인
 *     description: 승인 대기(REQUESTED) 명세서를 승인(APPROVED) 처리하고 승인 관리자와 승인 일시를 기록합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 승인 완료 (APPROVED) }
 *       '404': { description: 발주 명세서를 찾을 수 없습니다. }
 *       '409': { description: 허용되지 않는 상태 전이입니다. }
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
 */
router.post("/:specId/approve", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const spec = await approveOrderSpec(Number(specId), req.user.adminId);
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/admin/orders/specs/{specId}/reject:
 *   post:
 *     tags:
 *       - Admin Order Specs
 *     summary: 발주 반려
 *     description: 승인 대기(REQUESTED) 명세서를 반려(REJECTED) 처리하고 반려 사유, 반려 관리자, 반려 일시를 기록합니다.
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: "발주 수량이 과다합니다." }
 *     responses:
 *       '200': { description: 반려 완료 (REJECTED) }
 *       '400': { description: 반려 사유가 누락되었습니다. }
 *       '404': { description: 발주 명세서를 찾을 수 없습니다. }
 *       '409': { description: 허용되지 않는 상태 전이입니다. }
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
 */
router.post("/:specId/reject", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const spec = await rejectOrderSpec(
      Number(specId),
      req.user.adminId,
      req.body?.reason,
    );
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/admin/orders/specs/{specId}/issue:
 *   post:
 *     tags:
 *       - Admin Order Specs
 *     summary: 발주서 발행
 *     description: 승인 완료(APPROVED) 명세서를 발주서로 확정(ORDERED)하고 발주서 번호(PO-YYYYMMDD-XXXXXX)와 발행 일시를 기록합니다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       '200': { description: 발주서 발행 완료 (ORDERED) }
 *       '404': { description: 발주 명세서를 찾을 수 없습니다. }
 *       '409': { description: 허용되지 않는 상태 전이입니다. }
 *       '401': { description: 관리자 인증이 필요합니다. }
 *       '403': { description: 관리자 권한이 필요합니다. }
 */
router.post("/:specId/issue", async (req, res, next) => {
  const { specId } = req.params;
  if (!isValidId(specId)) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "specId는 1 이상의 정수여야 합니다.",
    });
  }

  try {
    const spec = await issueOrderSpec(Number(specId), req.user.adminId);
    return res.json(spec);
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

module.exports = router;
