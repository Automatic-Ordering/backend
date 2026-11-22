const SERVICE_LEVEL_Z = 1.65;
const SALES_WINDOW_DAYS = 7;
const FORECAST_PERIOD_DAYS = 1;

const WARNING_CODES = {
  NO_SALES_DATA: "NO_SALES_DATA",
  INSUFFICIENT_SALES_DATA: "INSUFFICIENT_SALES_DATA",
};

const assertNonNegativeInteger = (value, label, defaultValue) => {
  if (value === undefined || value === null) return defaultValue ?? 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label}은(는) 0 이상의 정수여야 합니다.`);
  }
  return parsed;
};

const assertPositiveInteger = (value, label, defaultValue) => {
  if (value === undefined || value === null) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }
  return parsed;
};
const assertNonNegativeSetting = (value, label, defaultValue) => {
  if (value === undefined || value === null) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label}은(는) 0 이상의 정수여야 합니다.`);
  }
  return parsed;
};

const buildDailySeries = (dailySales) => {
  if (!Array.isArray(dailySales)) return [];
  return dailySales
    .filter((entry) => entry && typeof entry.quantity === "number")
    .map((entry) => ({
      key: entry.date,
      quantity: entry.quantity,
    }));
};

const calculateDailyStats = (series) => {
  if (!series.length) return { sampleCount: 0, mean: 0, stdDev: 0 };
  const mean = series.reduce((sum, day) => sum + day.quantity, 0) / series.length;
  const variance =
    series.length >= 2
      ? series.reduce((sum, day) => sum + (day.quantity - mean) ** 2, 0) /
        (series.length - 1)
      : 0;
  return { sampleCount: series.length, mean, stdDev: Math.sqrt(variance) };
};

const calculateSafetyStock = ({ stdDev, leadTimeDays, serviceLevelZ }) => 0;

const calculateOrderQuantity = ({ targetStock, currentStock, incomingQuantity, orderUnit }) => {
  const target = assertNonNegativeInteger(targetStock, "목표 재고");
  const current = assertNonNegativeInteger(currentStock, "현재 재고");
  const rawOrderQuantity = target - current;
  return {
    rawOrderQuantity,
    orderQuantity: rawOrderQuantity > 0 ? rawOrderQuantity : 0,
  };
};

const calculateRecommendation = (input = {}) => {
  const currentStock = assertNonNegativeInteger(input.currentStock, "현재 재고");
  const safetyStock = assertNonNegativeInteger(
    input.configuredSafetyStock ?? input.safetyStock,
    "안전 재고",
  );
  const leadTimeDays = assertNonNegativeSetting(
    input.leadTimeDays,
    "리드타임",
    1,
  );
  const analysisDays = assertNonNegativeSetting(
    input.analysisDays,
    "분석일수",
    SALES_WINDOW_DAYS,
  );
  const safetyStockDays = assertNonNegativeSetting(
    input.safetyStockDays,
    "안전재고일수",
    2,
  );
  const orderUnit = input.orderUnit
      ? assertPositiveInteger(input.orderUnit, "발주 배수", 1)
      : 1;

  const series = buildDailySeries(input.dailySales);
  const recentSales = series.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const dataWarning = [];
  if (!series.length) dataWarning.push(WARNING_CODES.NO_SALES_DATA);
  else if (series.length < 2) dataWarning.push(WARNING_CODES.INSUFFICIENT_SALES_DATA);

  const avgDailySales = recentSales / analysisDays;
  const requiredEa = Math.max(
    0,
    Math.ceil(avgDailySales * (leadTimeDays + safetyStockDays)) - currentStock,
  );

const recommendedQty = requiredEa > 0
    ? Math.ceil(requiredEa / orderUnit)
    : 0;

  const totalExpectedEa = recommendedQty * orderUnit;
  const targetStock = Math.ceil(avgDailySales * (leadTimeDays + safetyStockDays));

  return {
    predictedDemand: recentSales,
    movingAverage: avgDailySales,
    sameWeekdayAverage: null,
    avgDailySales,
    dailyMean: avgDailySales,
    dailyStdDev: calculateDailyStats(series).stdDev,
    salesSeriesDays: series.length,
    serviceLevelZ: SERVICE_LEVEL_Z,
    leadTimeDays,
    forecastPeriodDays: FORECAST_PERIOD_DAYS,
    coverageDays: 1,
    orderUnit,
    computedSafetyStock: 0,
    configuredSafetyStock: safetyStock,
    appliedSafetyStock: safetyStock,
    safetyStockSource: "INVENTORY",
    targetStock,
    currentStock,
    incomingQuantity: 0,
    rawOrderQuantity: requiredEa,
    orderQuantity: recommendedQty,
    needsOrder: recommendedQty > 0,
    recommendedMultiplier: recommendedQty,
    totalExpectedEa,
    dataWarning,
  };
};

module.exports = {
  SERVICE_LEVEL_Z,
  SALES_WINDOW_DAYS,
  FORECAST_PERIOD_DAYS,
  WARNING_CODES,
  calculateRecommendation,
  calculateSafetyStock,
  calculateOrderQuantity,
  calculateDailyStats,
  buildDailySeries,
};
