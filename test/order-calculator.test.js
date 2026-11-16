const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SERVICE_LEVEL_Z,
  FORECAST_PERIOD_DAYS,
  WARNING_CODES,
  calculateRecommendation,
  calculateSafetyStock,
  calculateOrderQuantity,
  calculateDailyStats,
} = require("../src/services/orderCalculator");
const {
  WARNING_CODES: FORECAST_WARNING_CODES,
} = require("../src/services/demandForecast");

const seriesFrom = (quantities, endDate = "2026-11-08") => {
  const end = new Date(`${endDate}T00:00:00`);
  return quantities.map((quantity, offset) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (quantities.length - 1 - offset));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}`, quantity };
  });
};

test("calculateRecommendation: 7일 연속 동일 판매량 데이터로 계산", () => {
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
  assert.equal(result.sameWeekdayAverage, null);
  assert.equal(result.dailyStdDev, 0);
  assert.equal(result.salesSeriesDays, 7);
  assert.equal(result.computedSafetyStock, 0);
  assert.equal(result.configuredSafetyStock, null);
  assert.equal(result.appliedSafetyStock, 0);
  assert.equal(result.safetyStockSource, "NOT_APPLIED");
  assert.equal(result.forecastPeriodDays, 1);
  assert.equal(result.coverageDays, 1);
  assert.equal(result.targetStock, 4);
  assert.equal(result.orderQuantity, 5);
  assert.equal(result.needsOrder, true);
  assert.deepEqual(result.dataWarning, []);
});

test("calculateRecommendation: 예상 판매량은 최근 7일 합계/7", () => {
  // 최근 7일(11-02~11-08)만 사용한다. 그 이전 데이터(11-01 이전)는 무시된다.
  const result = calculateRecommendation({
    dailySales: seriesFrom([100, 100, 1, 2, 3, 4, 5, 6, 7]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  assert.equal(result.predictedDemand, 28 / 7);
  assert.equal(result.movingAverage, 28 / 7);
  assert.equal(result.targetStock, 4);
  assert.equal(result.orderQuantity, 4);
});

test("calculateRecommendation: 판매 데이터가 7일 미만이어도 항상 7으로 나눈다", () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([10, 10, 10]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  assert.ok(Math.abs(result.predictedDemand - 30 / 7) < 1e-9);
  assert.deepEqual(result.dataWarning, [
    FORECAST_WARNING_CODES.INSUFFICIENT_MOVING_AVERAGE_WINDOW,
  ]);
});

test("calculateRecommendation: 발주 단위 배수로 올림", () => {
  const base = {
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    incomingQuantity: 0,
    leadTimeDays: 2,
    configuredSafetyStock: 0,
  };

  assert.equal(
    calculateRecommendation({ ...base, currentStock: 0, orderUnit: 5 })
      .orderQuantity,
    5,
  );
  assert.equal(
    calculateRecommendation({ ...base, currentStock: 0, orderUnit: 1 })
      .orderQuantity,
    4,
  );
  assert.equal(
    calculateRecommendation({ ...base, currentStock: 2, orderUnit: 3 })
      .orderQuantity,
    3,
  );
});

test("calculateRecommendation: 현재 재고가 예상 판매량보다 많으면 발주량 0", () => {
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

test("calculateRecommendation: 현재 재고가 예상 판매량보다 적으면 차이만큼 발주", () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 3,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 1,
  });

  assert.equal(result.targetStock, 4);
  assert.equal(result.rawOrderQuantity, 1);
  assert.equal(result.orderQuantity, 1);
});

test("calculateRecommendation: 입고 예정 수량을 목표재고에서 차감 (중복 계산 없음)", () => {
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

  assert.equal(withoutIncoming.orderQuantity, 1);
  assert.equal(withIncoming.orderQuantity, 0);
  assert.equal(withIncoming.needsOrder, false);
});

test("calculateRecommendation: 점포 설정 안전재고는 발주 계산에 반영되지 않는다", () => {
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
  assert.equal(result.appliedSafetyStock, 0);
  assert.equal(result.safetyStockSource, "NOT_APPLIED");
  // 목표재고는 예상 판매량만으로 결정된다.
  assert.equal(result.targetStock, 4);
  assert.equal(result.orderQuantity, 4);
});

test("calculateRecommendation: 변동성(표준편차)은 발주량에 영향을 주지 않는다", () => {
  const flat = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 1,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 1,
  });
  const volatile = calculateRecommendation({
    dailySales: seriesFrom([1, 7, 1, 7, 1, 7, 4]),
    currentStock: 1,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 1,
  });

  // 7일 합계가 같으면(28) 변동성과 무관하게 동일한 발주량이다.
  assert.equal(volatile.predictedDemand, flat.predictedDemand);
  assert.ok(volatile.dailyStdDev > flat.dailyStdDev);
  assert.ok(volatile.computedSafetyStock > flat.computedSafetyStock);
  assert.equal(volatile.targetStock, flat.targetStock);
  assert.equal(volatile.orderQuantity, flat.orderQuantity);
});

test("calculateRecommendation: 요일별 이동평균은 계산에 반영되지 않는다", () => {
  // 마지막 날(11-08)과 다음 날(11-09)은 화요일이므로 예전 로직이라면
  // 화요일 표본 20이 가중 평균에 반영되었을 것이다.
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4, 20]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  // 예상 판매량 = 최근 7일 합계(44) / 7
  assert.ok(Math.abs(result.predictedDemand - 44 / 7) < 1e-9);
  assert.ok(Math.abs(result.movingAverage - 44 / 7) < 1e-9);
  assert.equal(result.sameWeekdayAverage, null);
});

test("calculateRecommendation: 예측 기간은 1일로 고정되어 리드타임과 무관하다", () => {
  const base = {
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 3,
    incomingQuantity: 0,
    orderUnit: 1,
    configuredSafetyStock: 0,
  };

  const shortLead = calculateRecommendation({ ...base, leadTimeDays: 1 });
  const longLead = calculateRecommendation({ ...base, leadTimeDays: 5 });

  assert.equal(FORECAST_PERIOD_DAYS, 1);
  assert.equal(shortLead.coverageDays, 1);
  assert.equal(longLead.coverageDays, 1);
  assert.equal(longLead.targetStock, shortLead.targetStock);
  assert.equal(longLead.orderQuantity, shortLead.orderQuantity);
});

test("calculateSafetyStock: 공식 직접 검증 (참고용, 발주 계산 미반영)", () => {
  assert.equal(
    calculateSafetyStock({ stdDev: 2, leadTimeDays: 4 }),
    Math.ceil(1.65 * 2 * 2),
  );
  assert.equal(calculateSafetyStock({ stdDev: 0, leadTimeDays: 3 }), 0);
  assert.equal(
    calculateSafetyStock({
      stdDev: 2.4397505,
      leadTimeDays: 1,
      serviceLevelZ: 2.33,
    }),
    6,
  );
});

test("calculateOrderQuantity: 단위 올림과 0 처리", () => {
  assert.deepEqual(
    calculateOrderQuantity({
      targetStock: 8,
      currentStock: 0,
      incomingQuantity: 0,
      orderUnit: 5,
    }),
    {
      rawOrderQuantity: 8,
      orderQuantity: 10,
    },
  );
  assert.deepEqual(
    calculateOrderQuantity({
      targetStock: 8,
      currentStock: 8,
      incomingQuantity: 2,
      orderUnit: 5,
    }),
    {
      rawOrderQuantity: -2,
      orderQuantity: 0,
    },
  );
});

test("calculateRecommendation: 데이터 부족 시 경고 반환", () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  assert.ok(Math.abs(result.predictedDemand - 12 / 7) < 1e-9);
  assert.equal(result.sameWeekdayAverage, null);
  assert.deepEqual(result.dataWarning, ["INSUFFICIENT_MOVING_AVERAGE_WINDOW"]);
});

test("calculateRecommendation: 판매 기록이 없는 날짜는 0으로 처리", () => {
  const result = calculateRecommendation({
    dailySales: [
      { date: "2026-11-02", quantity: 5 },
      { date: "2026-11-08", quantity: 5 },
    ],
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  assert.equal(result.salesSeriesDays, 7);
  assert.ok(Math.abs(result.predictedDemand - 10 / 7) < 1e-9);
  // 목표재고 = ceil(예상 판매량 × 1일)
  assert.equal(result.targetStock, Math.ceil(result.predictedDemand));
});

test("calculateRecommendation: 판매 기록이 전혀 없으면 발주 0과 경고", () => {
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

test("calculateRecommendation: 무판매 상품은 설정 안전재고가 있어도 발주 0", () => {
  const result = calculateRecommendation({
    dailySales: [],
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 3,
    configuredSafetyStock: 5,
  });

  assert.equal(result.configuredSafetyStock, 5);
  assert.equal(result.appliedSafetyStock, 0);
  assert.equal(result.safetyStockSource, "NOT_APPLIED");
  assert.equal(result.targetStock, 0);
  assert.equal(result.orderQuantity, 0);
  assert.equal(result.needsOrder, false);
  assert.deepEqual(result.dataWarning, [WARNING_CODES.NO_SALES_DATA]);
});

test("calculateRecommendation: 1일 데이터면 표준편차 0과 경고", () => {
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
  assert.ok(
    result.dataWarning.includes(
      FORECAST_WARNING_CODES.INSUFFICIENT_MOVING_AVERAGE_WINDOW,
    ),
  );
});

test("calculateRecommendation: 잘못된 입력은 거부한다", () => {
  const validSales = seriesFrom([4, 4, 4, 4, 4, 4, 4]);

  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: -1,
        leadTimeDays: 1,
        orderUnit: 1,
      }),
    /현재 재고/,
  );
  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 0,
        orderUnit: 1,
      }),
    /리드타임/,
  );
  assert.throws(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 0,
      }),
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
        dailySales: [{ date: "2026-11-08", quantity: -2 }],
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
          { date: "2026-11-08", quantity: 1 },
          { date: "2026-11-08", quantity: 2 },
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
        dailySales: [{ date: "invalid", quantity: 1 }],
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
      }),
    /날짜/,
  );
});

test("calculateDailyStats: 표본 표준편차(n-1) 계산", () => {
  const stats = calculateDailyStats([
    { key: "2026-11-02", quantity: 2 },
    { key: "2026-11-03", quantity: 4 },
    { key: "2026-11-04", quantity: 4 },
    { key: "2026-11-05", quantity: 4 },
    { key: "2026-11-06", quantity: 5 },
    { key: "2026-11-07", quantity: 5 },
    { key: "2026-11-08", quantity: 5 },
    { key: "2026-11-09", quantity: 7 },
  ]);

  assert.equal(stats.sampleCount, 8);
  assert.equal(stats.mean, 4.5);
  assert.ok(Math.abs(stats.stdDev - Math.sqrt(2)) < 1e-9);
  assert.equal(calculateDailyStats([]).stdDev, 0);
  assert.equal(calculateDailyStats([{ key: "x", quantity: 3 }]).stdDev, 0);
});

test("기본 서비스 계수는 1.65 (95% 서비스 수준, 참고용 안전재고에만 사용)", () => {
  assert.equal(SERVICE_LEVEL_Z, 1.65);
});
