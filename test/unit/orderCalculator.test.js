const {
  SERVICE_LEVEL_Z,
  FORECAST_PERIOD_DAYS,
  WARNING_CODES,
  calculateRecommendation,
  calculateSafetyStock,
  calculateOrderQuantity,
  calculateDailyStats,
} = require("../../src/services/orderCalculator");
const {
  WARNING_CODES: FORECAST_WARNING_CODES,
} = require("../../src/services/demandForecast");

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

  expect(result.predictedDemand).toBe(4);
  expect(result.movingAverage).toBe(4);
  expect(result.sameWeekdayAverage).toBeNull();
  expect(result.dailyStdDev).toBe(0);
  expect(result.salesSeriesDays).toBe(7);
  expect(result.computedSafetyStock).toBe(0);
  expect(result.configuredSafetyStock).toBeNull();
  expect(result.appliedSafetyStock).toBe(0);
  expect(result.safetyStockSource).toBe("NOT_APPLIED");
  expect(result.forecastPeriodDays).toBe(1);
  expect(result.coverageDays).toBe(1);
  expect(result.targetStock).toBe(4);
  expect(result.orderQuantity).toBe(5);
  expect(result.needsOrder).toBe(true);
  expect(result.dataWarning).toEqual([]);
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

  expect(result.predictedDemand).toBe(28 / 7);
  expect(result.movingAverage).toBe(28 / 7);
  expect(result.targetStock).toBe(4);
  expect(result.orderQuantity).toBe(4);
});

test("calculateRecommendation: 판매 데이터가 7일 미만이어도 항상 7으로 나눈다", () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([10, 10, 10]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  expect(result.predictedDemand).toBeCloseTo(30 / 7, 9);
  expect(result.dataWarning).toEqual([
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

  expect(
    calculateRecommendation({ ...base, currentStock: 0, orderUnit: 5 })
      .orderQuantity
  ).toBe(
    5
  );
  expect(
    calculateRecommendation({ ...base, currentStock: 0, orderUnit: 1 })
      .orderQuantity
  ).toBe(
    4
  );
  expect(
    calculateRecommendation({ ...base, currentStock: 2, orderUnit: 3 })
      .orderQuantity
  ).toBe(
    3
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

  expect(result.orderQuantity).toBe(0);
  expect(result.needsOrder).toBe(false);
  expect(result.rawOrderQuantity).toBeLessThan(0);
});

test("calculateRecommendation: 현재 재고가 예상 판매량보다 적으면 차이만큼 발주", () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([4, 4, 4, 4, 4, 4, 4]),
    currentStock: 3,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 1,
  });

  expect(result.targetStock).toBe(4);
  expect(result.rawOrderQuantity).toBe(1);
  expect(result.orderQuantity).toBe(1);
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

  expect(withoutIncoming.orderQuantity).toBe(1);
  expect(withIncoming.orderQuantity).toBe(0);
  expect(withIncoming.needsOrder).toBe(false);
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

  expect(result.computedSafetyStock).toBe(0);
  expect(result.configuredSafetyStock).toBe(6);
  expect(result.appliedSafetyStock).toBe(0);
  expect(result.safetyStockSource).toBe("NOT_APPLIED");
  // 목표재고는 예상 판매량만으로 결정된다.
  expect(result.targetStock).toBe(4);
  expect(result.orderQuantity).toBe(4);
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
  expect(volatile.predictedDemand).toBe(flat.predictedDemand);
  expect(volatile.dailyStdDev).toBeGreaterThan(flat.dailyStdDev);
  expect(volatile.computedSafetyStock).toBeGreaterThan(flat.computedSafetyStock);
  expect(volatile.targetStock).toBe(flat.targetStock);
  expect(volatile.orderQuantity).toBe(flat.orderQuantity);
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
  expect(result.predictedDemand).toBeCloseTo(44 / 7, 9);
  expect(result.movingAverage).toBeCloseTo(44 / 7, 9);
  expect(result.sameWeekdayAverage).toBeNull();
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

  expect(FORECAST_PERIOD_DAYS).toBe(1);
  expect(shortLead.coverageDays).toBe(1);
  expect(longLead.coverageDays).toBe(1);
  expect(longLead.targetStock).toBe(shortLead.targetStock);
  expect(longLead.orderQuantity).toBe(shortLead.orderQuantity);
});

test("calculateSafetyStock: 공식 직접 검증 (참고용, 발주 계산 미반영)", () => {
  expect(
    calculateSafetyStock({ stdDev: 2, leadTimeDays: 4 })
  ).toBe(
    Math.ceil(1.65 * 2 * 2)
  );
  expect(calculateSafetyStock({ stdDev: 0, leadTimeDays: 3 })).toBe(0);
  expect(
    calculateSafetyStock({
      stdDev: 2.4397505,
      leadTimeDays: 1,
      serviceLevelZ: 2.33,
    })
  ).toBe(
    6
  );
});

test("calculateOrderQuantity: 단위 올림과 0 처리", () => {
  expect(
    calculateOrderQuantity({
      targetStock: 8,
      currentStock: 0,
      incomingQuantity: 0,
      orderUnit: 5,
    })
  ).toEqual(
    {
      rawOrderQuantity: 8,
      orderQuantity: 10,
    }
  );
  expect(
    calculateOrderQuantity({
      targetStock: 8,
      currentStock: 8,
      incomingQuantity: 2,
      orderUnit: 5,
    })
  ).toEqual(
    {
      rawOrderQuantity: -2,
      orderQuantity: 0,
    }
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

  expect(result.predictedDemand).toBeCloseTo(12 / 7, 9);
  expect(result.sameWeekdayAverage).toBeNull();
  expect(result.dataWarning).toEqual(["INSUFFICIENT_MOVING_AVERAGE_WINDOW"]);
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

  expect(result.salesSeriesDays).toBe(7);
  expect(result.predictedDemand).toBeCloseTo(10 / 7, 9);
  // 목표재고 = ceil(예상 판매량 × 1일)
  expect(result.targetStock).toBe(Math.ceil(result.predictedDemand));
});

test("calculateRecommendation: 판매 기록이 전혀 없으면 발주 0과 경고", () => {
  const result = calculateRecommendation({
    dailySales: [],
    currentStock: 10,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 3,
  });

  expect(result.predictedDemand).toBe(0);
  expect(result.movingAverage).toBe(0);
  expect(result.sameWeekdayAverage).toBeNull();
  expect(result.dailyStdDev).toBe(0);
  expect(result.computedSafetyStock).toBe(0);
  expect(result.targetStock).toBe(0);
  expect(result.orderQuantity).toBe(0);
  expect(result.needsOrder).toBe(false);
  expect(result.dataWarning).toEqual([WARNING_CODES.NO_SALES_DATA]);
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

  expect(result.configuredSafetyStock).toBe(5);
  expect(result.appliedSafetyStock).toBe(0);
  expect(result.safetyStockSource).toBe("NOT_APPLIED");
  expect(result.targetStock).toBe(0);
  expect(result.orderQuantity).toBe(0);
  expect(result.needsOrder).toBe(false);
  expect(result.dataWarning).toEqual([WARNING_CODES.NO_SALES_DATA]);
});

test("calculateRecommendation: 1일 데이터면 표준편차 0과 경고", () => {
  const result = calculateRecommendation({
    dailySales: seriesFrom([3]),
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 1,
    orderUnit: 1,
  });

  expect(result.dailyStdDev).toBe(0);
  expect(result.salesSeriesDays).toBe(1);
  expect(result.dataWarning).toContain(WARNING_CODES.INSUFFICIENT_SALES_DATA);
  expect(result.dataWarning).toContain(
    FORECAST_WARNING_CODES.INSUFFICIENT_MOVING_AVERAGE_WINDOW,
  );
});

test("calculateRecommendation: 잘못된 입력은 거부한다", () => {
  const validSales = seriesFrom([4, 4, 4, 4, 4, 4, 4]);

  expect(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: -1,
        leadTimeDays: 1,
        orderUnit: 1,
      })
  ).toThrow(
    /현재 재고/
  );
  expect(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 0,
        orderUnit: 1,
      })
  ).toThrow(
    /리드타임/
  );
  expect(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 0,
      })
  ).toThrow(
    /발주 단위/
  );
  expect(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
        configuredSafetyStock: -3,
      })
  ).toThrow(
    /설정 안전재고/
  );
  expect(
    () =>
      calculateRecommendation({
        dailySales: validSales,
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
        serviceLevelZ: 0,
      })
  ).toThrow(
    /서비스 계수/
  );
  expect(
    () =>
      calculateRecommendation({
        dailySales: [{ date: "2026-11-08", quantity: -2 }],
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
      })
  ).toThrow(
    /판매량/
  );
  expect(
    () =>
      calculateRecommendation({
        dailySales: [
          { date: "2026-11-08", quantity: 1 },
          { date: "2026-11-08", quantity: 2 },
        ],
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
      })
  ).toThrow(
    /중복/
  );
  expect(
    () =>
      calculateRecommendation({
        dailySales: [{ date: "invalid", quantity: 1 }],
        currentStock: 1,
        leadTimeDays: 1,
        orderUnit: 1,
      })
  ).toThrow(
    /날짜/
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

  expect(stats.sampleCount).toBe(8);
  expect(stats.mean).toBe(4.5);
  expect(stats.stdDev).toBeCloseTo(Math.sqrt(2), 9);
  expect(calculateDailyStats([]).stdDev).toBe(0);
  expect(calculateDailyStats([{ key: "x", quantity: 3 }]).stdDev).toBe(0);
});

test("기본 서비스 계수는 1.65 (95% 서비스 수준, 참고용 안전재고에만 사용)", () => {
  expect(SERVICE_LEVEL_Z).toBe(1.65);
});
