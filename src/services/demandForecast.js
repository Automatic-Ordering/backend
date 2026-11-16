// 다음 날 수요 예측: 최근 7일 이동평균만 사용한다.
// 요일별 이동평균과 가중치 결합, 변동성 기반 보정은 발주 계산에서 제외되었다.
const MOVING_AVERAGE_WINDOW = 7;

const WARNING_CODES = {
  INSUFFICIENT_MOVING_AVERAGE_WINDOW: "INSUFFICIENT_MOVING_AVERAGE_WINDOW",
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

const parseLocalDateKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// 예상 판매량 = 최근 7일 판매량 합계 / 7.
// 판매 기록이 없는 날은 0으로 간주하고, 데이터가 7일 미만이어도 항상 7으로 나눈다.
const predictNextDayDemand = (dailySales) => {
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
  const cursor = new Date(startDate.getTime());
  while (cursor <= endDate) {
    const key = formatLocalDate(cursor);
    series.push(quantityByDate.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  const dataWarning = [];

  const recentQuantities = series.slice(-MOVING_AVERAGE_WINDOW);
  const movingAverage =
    recentQuantities.reduce((sum, quantity) => sum + quantity, 0) /
    MOVING_AVERAGE_WINDOW;
  if (series.length < MOVING_AVERAGE_WINDOW) {
    dataWarning.push(WARNING_CODES.INSUFFICIENT_MOVING_AVERAGE_WINDOW);
  }

  return {
    predictedDemand: Math.max(0, movingAverage),
    movingAverage,
    dataWarning,
  };
};

module.exports = {
  predictNextDayDemand,
  MOVING_AVERAGE_WINDOW,
  WARNING_CODES,
};
