const { predictNextDayDemand } = require('./demandForecast');

const SERVICE_LEVEL_Z = 1.65;
const SALES_WINDOW_DAYS = 120;

const WARNING_CODES = {
  NO_SALES_DATA: 'NO_SALES_DATA',
  INSUFFICIENT_SALES_DATA: 'INSUFFICIENT_SALES_DATA',
};

const pad = (value) => String(value).padStart(2, '0');

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateValue = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseLocalDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const assertNonNegativeInteger = (value, label, { allowNull = false, defaultValue } = {}) => {
  if (value === undefined || value === null) {
    if (allowNull || defaultValue !== undefined) {
      return defaultValue ?? 0;
    }
    throw new Error(`${label} 값이 필요합니다.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label}은(는) 0 이상의 정수여야 합니다. (입력값: ${String(value)})`);
  }
  return parsed;
};

const validateInputs = (input) => ({
  currentStock: assertNonNegativeInteger(input.currentStock, '현재 재고'),
  incomingQuantity: assertNonNegativeInteger(input.incomingQuantity, '입고 예정 수량', {
    allowNull: true,
    defaultValue: 0,
  }),
  leadTimeDays: assertNonNegativeInteger(input.leadTimeDays, '리드타임'),
  orderUnit: assertNonNegativeInteger(input.orderUnit, '발주 단위'),
  configuredSafetyStock: assertNonNegativeInteger(
    input.configuredSafetyStock,
    '설정 안전재고',
    { allowNull: true, defaultValue: 0 },
  ),
  serviceLevelZ:
    input.serviceLevelZ === undefined || input.serviceLevelZ === null
      ? SERVICE_LEVEL_Z
      : (() => {
          const z = Number(input.serviceLevelZ);
          if (!Number.isFinite(z) || z <= 0) {
            throw new Error(`서비스 계수는 0보다 큰 숫자여야 합니다. (입력값: ${String(input.serviceLevelZ)})`);
          }
          return z;
        })(),
});

const buildDailySeries = (dailySales) => {
  if (dailySales === undefined || dailySales === null) {
    return [];
  }
  if (!Array.isArray(dailySales)) {
    throw new Error('판매 데이터는 배열이어야 합니다.');
  }

  const quantityByDate = new Map();
  dailySales.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`판매 데이터 항목은 객체여야 합니다. (index=${index})`);
    }
    const date = parseDateValue(entry.date);
    if (!date) {
      throw new Error(`유효한 날짜가 아닙니다. (index=${index}, date=${String(entry.date)})`);
    }
    if (typeof entry.quantity !== 'number' || !Number.isFinite(entry.quantity) || entry.quantity < 0) {
      throw new Error(`판매량은 0 이상의 숫자여야 합니다. (index=${index}, quantity=${String(entry.quantity)})`);
    }
    const key = formatLocalDate(date);
    if (quantityByDate.has(key)) {
      throw new Error(`중복된 날짜가 있습니다. (index=${index}, date=${key})`);
    }
    quantityByDate.set(key, entry.quantity);
  });

  if (!quantityByDate.size) {
    return [];
  }

  const sortedKeys = [...quantityByDate.keys()].sort();
  const cursor = parseLocalDateKey(sortedKeys[0]);
  const endDate = parseLocalDateKey(sortedKeys[sortedKeys.length - 1]);

  const series = [];
  while (cursor <= endDate) {
    const key = formatLocalDate(cursor);
    series.push({
      key,
      quantity: quantityByDate.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
};

const calculateDailyStats = (series) => {
  if (!series.length) {
    return { sampleCount: 0, mean: 0, stdDev: 0 };
  }
  const sampleCount = series.length;
  const mean = series.reduce((sum, day) => sum + day.quantity, 0) / sampleCount;
  let stdDev = 0;
  if (sampleCount >= 2) {
    const variance =
      series.reduce((sum, day) => sum + (day.quantity - mean) ** 2, 0) / (sampleCount - 1);
    stdDev = Math.sqrt(variance);
  }
  return { sampleCount, mean, stdDev };
};

const calculateSafetyStock = ({ stdDev, leadTimeDays, serviceLevelZ = SERVICE_LEVEL_Z }) => {
  if (!Number.isFinite(stdDev) || stdDev < 0) {
    throw new Error('일일 판매량 표준편차는 0 이상의 숫자여야 합니다.');
  }
  const leadTime = assertNonNegativeInteger(leadTimeDays, '리드타임');
  if (leadTime < 1) {
    throw new Error('리드타임은 1일 이상이어야 합니다.');
  }
  if (!Number.isFinite(serviceLevelZ) || serviceLevelZ <= 0) {
    throw new Error('서비스 계수는 0보다 큰 숫자여야 합니다.');
  }
  return Math.ceil(serviceLevelZ * stdDev * Math.sqrt(leadTime));
};

const calculateOrderQuantity = ({ targetStock, currentStock, incomingQuantity, orderUnit }) => {
  const target = assertNonNegativeInteger(targetStock, '목표 재고');
  const current = assertNonNegativeInteger(currentStock, '현재 재고');
  const incoming = assertNonNegativeInteger(incomingQuantity, '입고 예정 수량', {
    allowNull: true,
    defaultValue: 0,
  });
  const unit = assertNonNegativeInteger(orderUnit, '발주 단위');
  if (unit < 1) {
    throw new Error('발주 단위는 1 이상이어야 합니다.');
  }

  const rawOrderQuantity = target - current - incoming;
  if (rawOrderQuantity <= 0) {
    return { rawOrderQuantity, orderQuantity: 0 };
  }
  return {
    rawOrderQuantity,
    orderQuantity: Math.ceil(rawOrderQuantity / unit) * unit,
  };
};

const calculateRecommendation = (input = {}) => {
  const {
    currentStock,
    incomingQuantity,
    leadTimeDays,
    orderUnit,
    configuredSafetyStock,
    serviceLevelZ,
  } = validateInputs(input);

  const dailySales = input.dailySales;
  const series = buildDailySeries(dailySales);
  const dataWarning = [];

  let prediction;
  if (!series.length) {
    prediction = {
      predictedDemand: 0,
      movingAverage: 0,
      sameWeekdayAverage: null,
      dataWarning: [],
    };
    dataWarning.push(WARNING_CODES.NO_SALES_DATA);
  } else {
    prediction = predictNextDayDemand(dailySales);
  }

  const stats = calculateDailyStats(series);
  if (series.length > 0 && series.length < 2) {
    dataWarning.push(WARNING_CODES.INSUFFICIENT_SALES_DATA);
  }

  const computedSafetyStock = calculateSafetyStock({
    stdDev: stats.stdDev,
    leadTimeDays,
    serviceLevelZ,
  });

  const hasConfiguredSafetyStock = configuredSafetyStock > 0;
  const appliedSafetyStock = hasConfiguredSafetyStock ? configuredSafetyStock : computedSafetyStock;
  const safetyStockSource = hasConfiguredSafetyStock ? 'CONFIGURED' : 'AUTO_CALCULATED';

  const targetStock = Math.ceil(prediction.predictedDemand * leadTimeDays) + appliedSafetyStock;
  const { rawOrderQuantity, orderQuantity } = calculateOrderQuantity({
    targetStock,
    currentStock,
    incomingQuantity,
    orderUnit,
  });

  return {
    predictedDemand: prediction.predictedDemand,
    movingAverage: prediction.movingAverage,
    sameWeekdayAverage: prediction.sameWeekdayAverage,
    dailyMean: stats.mean,
    dailyStdDev: stats.stdDev,
    salesSeriesDays: series.length,
    serviceLevelZ,
    leadTimeDays,
    orderUnit,
    computedSafetyStock,
    configuredSafetyStock: hasConfiguredSafetyStock ? configuredSafetyStock : null,
    appliedSafetyStock,
    safetyStockSource,
    targetStock,
    currentStock,
    incomingQuantity,
    rawOrderQuantity,
    orderQuantity,
    needsOrder: orderQuantity > 0,
    dataWarning: [...dataWarning, ...prediction.dataWarning],
  };
};

module.exports = {
  SERVICE_LEVEL_Z,
  SALES_WINDOW_DAYS,
  WARNING_CODES,
  calculateRecommendation,
  calculateSafetyStock,
  calculateOrderQuantity,
  calculateDailyStats,
  buildDailySeries,
};
