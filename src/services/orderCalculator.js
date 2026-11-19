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
  const analysisDays = assertPositiveInteger(
    input.analysisDays,
    "판매 분석 기간",
    SALES_WINDOW_DAYS,
  );
  const safetyStockDays = assertNonNegativeSetting(
    input.safetyStockDays,
    "안전재고 일수",
    2,
  );
  const leadTimeDays = assertNonNegativeSetting(
    input.leadTimeDays,
    "리드타임",
    1,
  );

  const series = buildDailySeries(input.dailySales);
  const recentSales = series.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const dataWarning = [];
  if (!series.length) dataWarning.push(WARNING_CODES.NO_SALES_DATA);
  else if (series.length < 2) dataWarning.push(WARNING_CODES.INSUFFICIENT_SALES_DATA);

  const predictedDemand =
    series.length ? recentSales / analysisDays : 0;
  const targetStock = Math.ceil(
    predictedDemand * (leadTimeDays + safetyStockDays),
  );
  const rawOrderQuantity = Math.max(0, targetStock - currentStock);

  return {
    predictedDemand,
    movingAverage: predictedDemand,
    sameWeekdayAverage: null,
    dailyMean: series.length ? recentSales / series.length : 0,
    dailyStdDev: calculateDailyStats(series).stdDev,
    salesSeriesDays: series.length,
    serviceLevelZ: SERVICE_LEVEL_Z,
    leadTimeDays,
    forecastPeriodDays: FORECAST_PERIOD_DAYS,
    coverageDays: leadTimeDays + safetyStockDays,
    orderUnit: 1,
    computedSafetyStock: 0,
    configuredSafetyStock: null,
    appliedSafetyStock: safetyStockDays,
    safetyStockSource: "CONFIGURED",
    targetStock,
    currentStock,
    incomingQuantity: 0,
    rawOrderQuantity,
    orderQuantity: rawOrderQuantity,
    needsOrder: rawOrderQuantity > 0,
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
