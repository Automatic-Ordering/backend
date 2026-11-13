const { StoreOrderSetting } = require("../../models");

// 점포별 자동 발주 기준 설정의 기본값.
// 기존 하드코딩 상수(orderCalculator.SERVICE_LEVEL_Z/SALES_WINDOW_DAYS,
// demandForecast.MOVING_AVERAGE_WINDOW/DEFAULT_WEIGHTS)와 동일한 값이다.
const DEFAULT_ORDER_SETTINGS = {
  analysisPeriodDays: 120,
  movingAverageDays: 7,
  movingAverageWeight: 0.4,
  sameWeekdayWeight: 0.6,
  serviceFactor: 1.65,
  forecastPeriodDays: 3,
};

const WEIGHT_SUM_TOLERANCE = 1e-9;

const createHttpError = (statusCode, code, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const isPositiveInteger = (value) => Number.isInteger(value) && value >= 1;

const isWeight = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

const isServiceFactor = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

// API 요청/응답은 snake_case 필드명을 사용하고, 모델 속성은 camelCase다.
const VALIDATORS = {
  analysis_period_days: {
    modelKey: "analysisPeriodDays",
    validate: (value) => isPositiveInteger(value),
    message: "analysis_period_days는 1 이상의 정수여야 합니다.",
  },
  moving_average_days: {
    modelKey: "movingAverageDays",
    validate: (value) => isPositiveInteger(value),
    message: "moving_average_days는 1 이상의 정수여야 합니다.",
  },
  moving_average_weight: {
    modelKey: "movingAverageWeight",
    validate: (value) => isWeight(value),
    message: "moving_average_weight는 0 이상 1 이하의 숫자여야 합니다.",
  },
  same_weekday_weight: {
    modelKey: "sameWeekdayWeight",
    validate: (value) => isWeight(value),
    message: "same_weekday_weight는 0 이상 1 이하의 숫자여야 합니다.",
  },
  service_factor: {
    modelKey: "serviceFactor",
    validate: (value) => isServiceFactor(value),
    message: "service_factor는 0보다 큰 숫자여야 합니다.",
  },
  forecast_period_days: {
    modelKey: "forecastPeriodDays",
    validate: (value) => isPositiveInteger(value),
    message: "forecast_period_days는 1 이상의 정수여야 합니다.",
  },
};

const ALLOWED_KEYS = Object.keys(VALIDATORS);

const serializeSetting = (setting) => ({
  store_id: setting.storeId,
  analysis_period_days: setting.analysisPeriodDays,
  moving_average_days: setting.movingAverageDays,
  moving_average_weight: Number(setting.movingAverageWeight),
  same_weekday_weight: Number(setting.sameWeekdayWeight),
  service_factor: Number(setting.serviceFactor),
  forecast_period_days: setting.forecastPeriodDays,
  created_at: setting.createdAt,
  updated_at: setting.updatedAt,
});

// 설정 행이 없으면 기본값으로 생성한다(점포당 1행 보장).
// 점포가 존재하지 않아 FK 제약에 걸리면 404로 변환한다.
const getStoreOrderSettings = async (storeId) => {
  const existing = await StoreOrderSetting.findOne({ where: { storeId } });
  if (existing) {
    return existing;
  }
  try {
    return await StoreOrderSetting.create({
      storeId,
      ...DEFAULT_ORDER_SETTINGS,
    });
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      throw createHttpError(404, "NOT_FOUND", "점포를 찾을 수 없습니다.");
    }
    throw error;
  }
};

const validatePatch = (patch, currentWeights) => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      "요청 본문은 설정 객체여야 합니다.",
    );
  }

  const unknownKeys = Object.keys(patch).filter(
    (key) => !ALLOWED_KEYS.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      `허용되지 않는 필드가 포함되어 있습니다. (${unknownKeys.join(", ")})`,
    );
  }

  if (Object.keys(patch).length === 0) {
    throw createHttpError(400, "INVALID_INPUT", "변경할 설정 값이 없습니다.");
  }

  const updates = {};
  for (const [apiKey, { modelKey, validate, message }] of Object.entries(
    VALIDATORS,
  )) {
    if (patch[apiKey] === undefined) {
      continue;
    }
    if (!validate(patch[apiKey])) {
      throw createHttpError(400, "INVALID_INPUT", message);
    }
    updates[modelKey] = patch[apiKey];
  }

  // 이동평균 가중치와 동일 요일 가중치의 합은 1이어야 한다.
  // 두 가중치 중 하나라도 변경하면 (변경값 + 미변경 현재값) 합을 검증한다.
  if (
    updates.movingAverageWeight !== undefined ||
    updates.sameWeekdayWeight !== undefined
  ) {
    const movingAverage =
      updates.movingAverageWeight ?? currentWeights.movingAverage;
    const sameWeekday =
      updates.sameWeekdayWeight ?? currentWeights.sameWeekday;
    const sum = movingAverage + sameWeekday;
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      throw createHttpError(
        400,
        "INVALID_INPUT",
        `이동평균 가중치와 동일 요일 가중치의 합은 1이어야 합니다. (합계: ${sum})`,
      );
    }
  }

  return updates;
};

// 현재 점포의 설정만 변경한다. storeId는 항상 인증 토큰에서 가져온다.
const updateStoreOrderSettings = async (storeId, patch) => {
  const setting = await getStoreOrderSettings(storeId);
  const updates = validatePatch(patch, {
    movingAverage: Number(setting.movingAverageWeight),
    sameWeekday: Number(setting.sameWeekdayWeight),
  });

  Object.assign(setting, updates);
  await setting.save();
  return setting;
};

module.exports = {
  DEFAULT_ORDER_SETTINGS,
  getStoreOrderSettings,
  updateStoreOrderSettings,
  serializeSetting,
};
