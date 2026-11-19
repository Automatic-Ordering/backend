const { StoreOrderSetting } = require("../../models");
const { createHttpError } = require("../utils/httpError");

const DEFAULT_ORDER_SETTINGS = {
  analysisDays: 7,
  safetyStockDays: 2,
  leadTimeDays: 1,
};

const isPositiveInteger = (value) => Number.isInteger(value) && value >= 1;
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

const VALIDATORS = {
  analysis_days: {
    modelKey: "analysisDays",
    validate: isPositiveInteger,
    message: "analysis_days는 1 이상의 정수여야 합니다.",
  },
  safety_stock_days: {
    modelKey: "safetyStockDays",
    validate: isNonNegativeInteger,
    message: "safety_stock_days는 0 이상의 정수여야 합니다.",
  },
  lead_time_days: {
    modelKey: "leadTimeDays",
    validate: isNonNegativeInteger,
    message: "lead_time_days는 0 이상의 정수여야 합니다.",
  },
};

const serializeSetting = (setting) => ({
  store_id: setting.storeId,
  analysis_days: setting.analysisDays,
  safety_stock_days: setting.safetyStockDays,
  lead_time_days: setting.leadTimeDays,
  created_at: setting.createdAt,
  updated_at: setting.updatedAt,
});

const getStoreOrderSettings = async (storeId) => {
  const existing = await StoreOrderSetting.findOne({ where: { storeId } });
  if (existing) return existing;
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

const updateStoreOrderSettings = async (storeId, patch) => {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw createHttpError(400, "INVALID_INPUT", "요청 본문은 설정 객체여야 합니다.");
  }
  const allowedKeys = Object.keys(VALIDATORS);
  const unknownKeys = Object.keys(patch).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length) {
    throw createHttpError(
      400,
      "INVALID_INPUT",
      `허용되지 않는 필드가 포함되어 있습니다. (${unknownKeys.join(", ")})`,
    );
  }
  if (!Object.keys(patch).length) {
    throw createHttpError(400, "INVALID_INPUT", "변경할 설정 값이 없습니다.");
  }

  const setting = await getStoreOrderSettings(storeId);
  const updates = {};
  for (const [apiKey, { modelKey, validate, message }] of Object.entries(VALIDATORS)) {
    if (patch[apiKey] === undefined) continue;
    if (!validate(patch[apiKey])) {
      throw createHttpError(400, "INVALID_INPUT", message);
    }
    updates[modelKey] = patch[apiKey];
  }
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
