const express = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  getStoreOrderSettings,
  updateStoreOrderSettings,
  serializeSetting,
} = require("../services/storeOrderSettingService");

const router = express.Router();

router.use(authenticate, requireRole("STORE"));

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
 * /api/store/order-settings:
 *   get:
 *     tags:
 *       - Store Order Settings
 *     summary: 점포 자동 발주 기준 설정 조회
 *     description: 현재 로그인된 점포의 자동 발주 계산 기준 설정을 조회합니다. 설정 행이 없으면 기본값(120일, 7일, 0.4, 0.6, 1.65, 3일)으로 생성해 반환합니다.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200': { description: 자동 발주 기준 설정 }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.get("/", async (req, res, next) => {
  try {
    const setting = await getStoreOrderSettings(req.user.storeId);
    return res.json(serializeSetting(setting));
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

/**
 * @openapi
 * /api/store/order-settings:
 *   patch:
 *     tags:
 *       - Store Order Settings
 *     summary: 점포 자동 발주 기준 설정 수정
 *     description: |
 *       현재 로그인된 점포의 자동 발주 계산 기준 설정을 수정합니다.
 *       - 분석 기간·이동평균 기간·예측 기간은 1 이상의 정수
 *       - 두 가중치는 각각 0 이상 1 이하이고 합이 1
 *       - 서비스 계수는 0보다 큰 숫자
 *       - 위 규칙 외의 필드(예: store_id)는 허용되지 않습니다.
 *       점포 ID는 항상 인증 토큰에서 가져오므로 다른 점포의 설정은 수정할 수 없습니다.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               analysis_period_days: { type: integer, minimum: 1, example: 90 }
 *               moving_average_days: { type: integer, minimum: 1, example: 7 }
 *               moving_average_weight: { type: number, minimum: 0, maximum: 1, example: 0.4 }
 *               same_weekday_weight: { type: number, minimum: 0, maximum: 1, example: 0.6 }
 *               service_factor: { type: number, exclusiveMinimum: 0, example: 1.65 }
 *               forecast_period_days: { type: integer, minimum: 1, example: 3 }
 *     responses:
 *       '200': { description: 수정된 자동 발주 기준 설정 }
 *       '400': { description: 입력값이 올바르지 않습니다. }
 *       '401': { description: 점포 인증이 필요합니다. }
 *       '403': { description: 점포 권한이 필요합니다. }
 */
router.patch("/", async (req, res, next) => {
  try {
    const setting = await updateStoreOrderSettings(req.user.storeId, req.body);
    return res.json(serializeSetting(setting));
  } catch (error) {
    return handleServiceError(res, next, error);
  }
});

module.exports = router;
