const assert = require('node:assert/strict');
const test = require('node:test');
const {
  SERVICE_LEVEL_Z,
  WARNING_CODES,
  calculateRecommendation,
  calculateSafetyStock,
  calculateOrderQuantity,
  calculateDailyStats,
} = require('../src/services/orderCalculator');

const seriesFrom = (quantities, endDate = '2026-11-08') => {
  const end = new Date(`${endDate}T00:00:00`);
  return quantities.map((quantity, offset) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (quantities.length - 1 - offset));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, quantity };
  });
};

test('calculateRecommendation: 7일 연속 동일 판매량 데이터로 계산', () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 3,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 5,
    configuredSafetyStock: 0,
  });

  assert.equal(result.predictedDemand, 4);
  assert.equal(result.movingAverage, 4);
  assert.equal(result.sameWeekdayAverage, 4);
  assert.equal(result.dailyStdDev, 0);
  assert.equal(result.salesSeriesDays, 7);
  assert.equal(result.computedSafetyStock, 0);
  assert.equal(result.appliedSafetyStock, 0);
  assert.equal(result.safetyStockSource, 'AUTO_CALCULATED');
  assert.equal(result.targetStock, 8);
  assert.equal(result.orderQuantity, 5);
  assert.equal(result.needsOrder, true);
  assert.deepEqual(result.dataWarning, []);
});

test('calculateRecommendation: 발주 단위 배수로 올림', () => {
  const base = {
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    incomingQuantity: 0,
    leadTimeDays: 2,
    configuredSafetyStock: 0,
  };

  assert.equal(calculateRecommendation({ ...base, currentStock: 0, orderUnit: 5 }).orderQuantity, 10);
  assert.equal(calculateRecommendation({ ...base, currentStock: 0, orderUnit: 1 }).orderQuantity, 8);
  assert.equal(calculateRecommendation({ ...base, currentStock: 2, orderUnit: 3 }).orderQuantity, 6);
});

test('calculateRecommendation: 재고와 입고 예정이 충분하면 발주량 0', () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 20,
    incomingQuantity: 5,
    leadTimeDays: 2,
    orderUnit: 5,
  });

  assert.equal(result.orderQuantity, 0);
  assert.equal(result.needsOrder, false);
  assert.ok(result.rawOrderQuantity < 0);
});

test('calculateRecommendation: 입고 예정 수량을 목표재고에서 차감 (중복 계산 없음)', () => {
  const withoutIncoming = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 3,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 1,
  });
  const withIncoming = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 3,
    incomingQuantity: 4,
    leadTimeDays: 2,
    orderUnit: 1,
  });

  assert.equal(withoutIncoming.orderQuantity, 5);
  assert.equal(withIncoming.orderQuantity, 1);
});

test('calculateRecommendation: 설정 안전재고가 있으면 자동 계산값 대신 적용', () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 3,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 4,
    configuredSafetyStock: 6,
  });

  assert.equal(result.computedSafetyStock, 0);
  assert.equal(result.configuredSafetyStock, 6);
  assert.equal(result.appliedSafetyStock, 6);
  assert.equal(result.safetyStockSource, 'CONFIGURED');
  assert.equal(result.targetStock, 14);
  assert.equal(result.orderQuantity, 12);
});

test('calculateRecommendation: 안전재고 = ceil(서비스 계수 × 표준편차 × √리드타임)', () => {
  const result = calculateRecommendation({
    dailySales: [
      { date: '2026-11-02', quantity: 5 },
      { date: '2026-11-08', quantity: 5 },
    ],
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  const expectedStdDev = Math.sqrt(1750 / 294);
  assert.ok(Math.abs(result.dailyStdDev - expectedStdDev) < 1e-9);
  assert.equal(result.computedSafetyStock, Math.ceil(SERVICE_LEVEL_Z * expectedStdDev));
  assert.equal(result.appliedSafetyStock, Math.ceil(SERVICE_LEVEL_Z * expectedStdDev));
  assert.equal(result.safetyStockSource, 'AUTO_CALCULATED');
  assert.equal(result.targetStock, Math.ceil(result.predictedDemand) + result.appliedSafetyStock);
  assert.equal(result.orderQuantity, result.targetStock);
});

test('calculateSafetyStock: 공식 직접 검증', () => {
  assert.equal(calculateSafetyStock({ stdDev: 2, leadTimeDays: 4 }), Math.ceil(1.65 * 2 * 2));
  assert.equal(calculateSafetyStock({ stdDev: 0, leadTimeDays: 3 }), 0);
  assert.equal(
    calculateSafetyStock({ stdDev: 2.4397505, leadTimeDays: 1, serviceLevelZ: 2.33 }),
    6,
  );
});

test('calculateOrderQuantity: 단위 올림과 0 처리', () => {
  assert.deepEqual(calculateOrderQuantity({ targetStock: 8, currentStock: 0, incomingQuantity: 0, orderUnit: 5 }), {
    rawOrderQuantity: 8,
    orderQuantity: 10,
  });
  assert.deepEqual(calculateOrderQuantity({ targetStock: 8, currentStock: 8, incomingQuantity: 2, orderUnit: 5 }), {
    rawOrderQuantity: -2,
    orderQuantity: 0,
  });
});

test('calculateRecommendation: 데이터 부족 시 가용 데이터로 계산하고 경고 반환', () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  assert.equal(result.predictedDemand, 4);
  assert.equal(result.sameWeekdayAverage, null);
  assert.deepEqual(result.dataWarning, [
    'INSUFFICIENT_MOVING_AVERAGE_WINDOW',
    'NO_SAME_WEEKDAY_DATA',
  ]);
});

test('calculateRecommendation: 판매 기록이 없는 날짜는 0으로 처리', () => {
  const result = calculateRecommendation({
    dailySales: [
      { date: '2026-11-02', quantity: 5 },
      { date: '2026-11-08', quantity: 5 },
    ],
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  assert.equal(result.salesSeriesDays, 7);
  assert.ok(Math.abs(result.predictedDemand - (0.4 * (10 / 7) + 0.6 * 5)) < 1e-9);
});

test('calculateRecommendation: 판매 기록이 전혀 없으면 발주 0과 경고', () => {
  const result = calculateRecommendation({
    dailySales: [],
    currentStock: 10,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 3,
  });

  assert.equal(result.predictedDemand, 0);
  assert.equal(result.movingAverage, 0);
  assert.equal(result.sameWeekdayAverage, null);
  assert.equal(result.dailyStdDev, 0);
  assert.equal(result.computedSafetyStock, 0);
  assert.equal(result.targetStock, 0);
  assert.equal(result.orderQuantity, 0);
  assert.equal(result.needsOrder, false);
  assert.deepEqual(result.dataWarning, [WARNING_CODES.NO_SALES_DATA]);
});

test('calculateRecommendation: 설정 안전재고가 있으면 무판매 상품도 안전재고만큼 발주', () => {
  const result = calculateRecommendation({
    dailySales: [],
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 3,
    configuredSafetyStock: 5,
  });

  assert.equal(result.appliedSafetyStock, 5);
  assert.equal(result.safetyStockSource, 'CONFIGURED');
  assert.equal(result.targetStock, 5);
  assert.equal(result.orderQuantity, 6);
  assert.deepEqual(result.dataWarning, [WARNING_CODES.NO_SALES_DATA]);
});

test('calculateRecommendation: 1일 데이터면 표준편차 0과 경고', () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([3]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  assert.equal(result.dailyStdDev, 0);
  assert.equal(result.salesSeriesDays, 1);
  assert.ok(result.dataWarning.includes(WARNING_CODES.INSUFFICIENT_SALES_DATA));
});

test('calculateRecommendation: 잘못된 입력은 거부한다', () => {
  const validSales = seriesFrom([4, 4, 4, 4, 4, 4, 4]);

  assert.throws(
    () => calculateRecommendation({ dailySales: validSales, currentStock: -1, leadTimeDays: 1, orderUnit: 1 }),
    /현재 재고/,
  );
  assert.throws(
    () => calculateRecommendation({ dailySales: validSales, currentStock: 1, leadTimeDays: 0, orderUnit: 1 }),
    /리드타임/,
  );
  assert.throws(
    () => calculateRecommendation({ dailySales: validSales, currentStock: 1, leadTimeDays: 1, orderUnit: 0 }),
    /발주 단위/,
  );
  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
        configuredSafetyStock: -3,
      }),
    /설정 안전재고/,
  );
  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
        serviceLevelZ: 0,
      }),
    /서비스 계수/,
  );
  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: [{ date: '2026-11-08', quantity: -2 }],
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
      }),
    /판매량/,
  );
  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: [
          { date: '2026-11-08', quantity: 1 },
          { date: '2026-11-08', quantity: 2 },
        ],
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
      }),
    /중복/,
  );
  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: [{ date: 'invalid', quantity: 1 }],
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
      }),
    /날짜/,
  );
});

test('calculateDailyStats: 표본 표준편차(n-1) 계산', () => {
  const stats = calculateDailyStats([
    { key: '2026-11-02', quantity: 2 },
    { key: '2026-11-03', quantity: 4 },
    { key: '2026-11-04', quantity: 4 },
    { key: '2026-11-05', quantity: 4 },
    { key: '2026-11-06', quantity: 5 },
    { key: '2026-11-07', quantity: 5 },
    { key: '2026-11-08', quantity: 5 },
    { key: '2026-11-09', quantity: 7 },
  ]);

  assert.equal(stats.sampleCount, 8);
  assert.equal(stats.mean, 4.5);
  assert.ok(Math.abs(stats.stdDev - Math.sqrt(2)) < 1e-9);
  assert.equal(calculateDailyStats([]).stdDev, 0);
  assert.equal(calculateDailyStats([{ key: 'x', quantity: 3 }]).stdDev, 0);
});

test('기본 서비스 계수는 1.65 (95% 서비스 수준)', () => {
  assert.equal(SERVICE_LEVEL_Z, 1.65);
});
