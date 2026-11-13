const DEFAULT_WEIGHTS = {
  movingAverage: 0.4,
  sameWeekday: 0.6,
};

const MOVING_AVERAGE_WINDOW = 7;

const WARNING_CODES = {
  INSUFFICIENT_MOVING_AVERAGE_WINDOW: "INSUFFICIENT_MOVING_AVERAGE_WINDOW",
  NO_SAME_WEEKDAY_DATA: "NO_SAME_WEEKDAY_DATA",
};

const pad = (value) => String(value).padStart(2, "0");

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateValue = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseLocalDateKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const validateEntry = (entry, index) => {
  if (!entry || typeof entry !== "object") {
    throw new Error(`판매 데이터 항목은 객체여야 합니다. (index=${index})`);
  }

  const date = parseDateValue(entry.date);
  if (!date) {
    throw new Error(
      `유효한 날짜가 아닙니다. (index=${index}, date=${String(entry.date)})`,
    );
  }

  if (typeof entry.quantity !== "number" || !Number.isFinite(entry.quantity)) {
    throw new Error(
      `판매량은 숫자여야 합니다. (index=${index}, quantity=${String(entry.quantity)})`,
    );
  }

  if (entry.quantity < 0) {
    throw new Error(
      `판매량은 음수일 수 없습니다. (index=${index}, quantity=${entry.quantity})`,
    );
  }

  return date;
};

const resolveWeights = (options) => {
  const weights = options?.weights ?? DEFAULT_WEIGHTS;
  const movingAverage = Number(weights?.movingAverage);
  const sameWeekday = Number(weights?.sameWeekday);

  if (!Number.isFinite(movingAverage) || movingAverage < 0) {
    throw new Error("이동평균 가중치는 0 이상의 숫자여야 합니다.");
  }
  if (!Number.isFinite(sameWeekday) || sameWeekday < 0) {
    throw new Error("동요일 가중치는 0 이상의 숫자여야 합니다.");
  }

  const sum = movingAverage + sameWeekday;
  if (sum <= 0) {
    throw new Error("가중치 합은 0보다 커야 합니다.");
  }

  return { movingAverage: movingAverage / sum, sameWeekday: sameWeekday / sum };
};

const predictNextDayDemand = (dailySales, options = {}) => {
  if (!Array.isArray(dailySales) || dailySales.length === 0) {
    throw new Error("판매 데이터 배열이 비어 있습니다.");
  }

  const quantityByDate = new Map();
  dailySales.forEach((entry, index) => {
    const date = validateEntry(entry, index);
    const key = formatLocalDate(date);
    if (quantityByDate.has(key)) {
      throw new Error(`중복된 날짜가 있습니다. (index=${index}, date=${key})`);
    }
    quantityByDate.set(key, entry.quantity);
  });

  const sortedKeys = [...quantityByDate.keys()].sort();
  const startDate = parseLocalDateKey(sortedKeys[0]);
  const endDate = parseLocalDateKey(sortedKeys[sortedKeys.length - 1]);

  const series = [];
  const cursor = startDate;
  while (cursor <= endDate) {
    const key = formatLocalDate(cursor);
    series.push({
      key,
      quantity: quantityByDate.get(key) ?? 0,
      weekday: cursor.getDay(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const dataWarning = [];

  const windowSize = Math.min(MOVING_AVERAGE_WINDOW, series.length);
  const movingAverage =
    series.slice(-windowSize).reduce((sum, day) => sum + day.quantity, 0) /
    windowSize;
  if (series.length < MOVING_AVERAGE_WINDOW) {
    dataWarning.push(WARNING_CODES.INSUFFICIENT_MOVING_AVERAGE_WINDOW);
  }

  const targetDate = new Date(endDate);
  targetDate.setDate(endDate.getDate() + 1);
  const targetWeekday = targetDate.getDay();

  const weekdayValues = series
    .filter((day) => day.weekday === targetWeekday)
    .map((day) => day.quantity);

  let sameWeekdayAverage = null;
  if (weekdayValues.length > 0) {
    sameWeekdayAverage =
      weekdayValues.reduce((sum, quantity) => sum + quantity, 0) /
      weekdayValues.length;
  } else {
    dataWarning.push(WARNING_CODES.NO_SAME_WEEKDAY_DATA);
  }

  const weights = resolveWeights(options);

  let predictedDemand;
  if (sameWeekdayAverage === null) {
    predictedDemand = movingAverage;
  } else {
    predictedDemand =
      weights.movingAverage * movingAverage +
      weights.sameWeekday * sameWeekdayAverage;
  }
  predictedDemand = Math.max(0, predictedDemand);

  return {
    predictedDemand,
    movingAverage,
    sameWeekdayAverage,
    dataWarning,
  };
};

module.exports = {
  predictNextDayDemand,
  DEFAULT_WEIGHTS,
  WARNING_CODES,
};
