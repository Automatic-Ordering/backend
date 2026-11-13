const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const { sequelize } = require("../config/database");
const { StoreOrderSetting } = require("../models");
const { calculateRecommendation } = require("../src/services/orderCalculator");
const {
  DEFAULT_ORDER_SETTINGS,
} = require("../src/services/storeOrderSettingService");
const {
  app,
  adminToken,
  storeToken,
  setQueryMock,
} = require("./support/test-app");

const setStoreAuthMock = () => {
  setQueryMock(async (sql) => {
    if (sql.includes("FROM stores s")) {
      return [
        [
          {
            store_id: 1,
            store_code: "10001",
            store_name: "Store A",
            status: "ACTIVE",
            account_id: 1,
            password_change_required: 0,
          },
        ],
      ];
    }
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });
};

const setAdminAuthMock = () => {
  setQueryMock(async (sql) => {
    if (sql.includes("FROM admins")) {
      return [[{ admin_id: 1 }]];
    }
    if (sql.includes("FROM stores s")) {
      return [[
        {
          store_id: 1,
          store_code: "10001",
          store_name: "Store A",
          status: "ACTIVE",
          account_id: 1,
          password_change_required: 0,
        },
      ]];
    }
    throw new Error(`Unexpected authentication query: ${sql}`);
  });
};

const overrideMethod = (target, key, implementation) => {
  const original = target[key];
  target[key] = implementation;
  return () => {
    target[key] = original;
  };
};

const buildSettingsInstance = (overrides = {}) => ({
  settingId: 1,
  storeId: 1,
  analysisPeriodDays: 120,
  movingAverageDays: 7,
  movingAverageWeight: "0.400",
  sameWeekdayWeight: "0.600",
  serviceFactor: "1.650",
  forecastPeriodDays: 3,
  createdAt: new Date("2026-11-14T00:00:00Z"),
  updatedAt: new Date("2026-11-14T00:00:00Z"),
  saveCalls: 0,
  save: async function () {
    this.saveCalls += 1;
  },
  ...overrides,
});

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

test("order settings endpoints require store authentication", async () => {
  const unauthorized = await request(app).get("/api/store/order-settings");
  assert.equal(unauthorized.status, 401);

  setAdminAuthMock();
  const adminOnStore = await request(app)
    .get("/api/store/order-settings")
    .set("Authorization", `Bearer ${adminToken()}`);
  assert.equal(adminOnStore.status, 403);
});

test("GET returns existing store settings", async () => {
  setStoreAuthMock();

  const findOneCalls = [];
  const restoreFindOne = overrideMethod(
    StoreOrderSetting,
    "findOne",
    async (args) => {
      findOneCalls.push(args);
      return buildSettingsInstance({ analysisPeriodDays: 90 });
    },
  );

  try {
    const response = await request(app)
      .get("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(findOneCalls[0].where.storeId, 1);
    assert.equal(response.body.store_id, 1);
    assert.equal(response.body.analysis_period_days, 90);
    assert.equal(response.body.moving_average_days, 7);
    assert.equal(response.body.moving_average_weight, 0.4);
    assert.equal(response.body.same_weekday_weight, 0.6);
    assert.equal(response.body.service_factor, 1.65);
    assert.equal(response.body.forecast_period_days, 3);
  } finally {
    restoreFindOne();
  }
});

test("GET creates default settings when missing", async () => {
  setStoreAuthMock();

  const createCalls = [];
  const restoreFindOne = overrideMethod(
    StoreOrderSetting,
    "findOne",
    async () => null,
  );
  const restoreCreate = overrideMethod(
    StoreOrderSetting,
    "create",
    async (values) => {
      createCalls.push(values);
      return buildSettingsInstance(values);
    },
  );

  try {
    const response = await request(app)
      .get("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`);

    assert.equal(response.status, 200);
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].storeId, 1);
    assert.deepEqual(
      {
        analysisPeriodDays: createCalls[0].analysisPeriodDays,
        movingAverageDays: createCalls[0].movingAverageDays,
        movingAverageWeight: createCalls[0].movingAverageWeight,
        sameWeekdayWeight: createCalls[0].sameWeekdayWeight,
        serviceFactor: createCalls[0].serviceFactor,
        forecastPeriodDays: createCalls[0].forecastPeriodDays,
      },
      DEFAULT_ORDER_SETTINGS,
    );
    assert.equal(response.body.analysis_period_days, 120);
    assert.equal(response.body.moving_average_days, 7);
    assert.equal(response.body.moving_average_weight, 0.4);
    assert.equal(response.body.same_weekday_weight, 0.6);
    assert.equal(response.body.service_factor, 1.65);
    assert.equal(response.body.forecast_period_days, 3);
  } finally {
    restoreFindOne();
    restoreCreate();
  }
});

test("PATCH updates allowed settings fields only for the token store", async () => {
  setStoreAuthMock();

  const instance = buildSettingsInstance();
  const restoreFindOne = overrideMethod(
    StoreOrderSetting,
    "findOne",
    async (args) => {
      assert.equal(args.where.storeId, 1);
      return instance;
    },
  );

  try {
    const response = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({
        analysis_period_days: 90,
        service_factor: 1.8,
        forecast_period_days: 5,
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.analysis_period_days, 90);
    assert.equal(response.body.service_factor, 1.8);
    assert.equal(response.body.forecast_period_days, 5);
    assert.equal(instance.saveCalls, 1);
    // PATCH 본문에 store_id를 넣어도 토큰 점포만 수정 대상이 된다.
    assert.equal(instance.storeId, 1);
  } finally {
    restoreFindOne();
  }
});

test("PATCH rejects unknown fields including store_id of other stores", async () => {
  setStoreAuthMock();

  const restoreFindOne = overrideMethod(
    StoreOrderSetting,
    "findOne",
    async () => buildSettingsInstance(),
  );

  try {
    const otherStore = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ store_id: 2, analysis_period_days: 60 });
    assert.equal(otherStore.status, 400);
    assert.match(otherStore.body.message, /store_id/);

    const unknown = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ mystery_field: 1 });
    assert.equal(unknown.status, 400);
    assert.match(unknown.body.message, /mystery_field/);

    const empty = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({});
    assert.equal(empty.status, 400);
  } finally {
    restoreFindOne();
  }
});

test("PATCH validates setting value ranges", async () => {
  setStoreAuthMock();

  const restoreFindOne = overrideMethod(
    StoreOrderSetting,
    "findOne",
    async () => buildSettingsInstance(),
  );

  const invalidCases = [
    [{ analysis_period_days: 0 }, /analysis_period_days/],
    [{ analysis_period_days: 12.5 }, /analysis_period_days/],
    [{ analysis_period_days: "90" }, /analysis_period_days/],
    [{ moving_average_days: 0 }, /moving_average_days/],
    [{ forecast_period_days: 0 }, /forecast_period_days/],
    [{ moving_average_weight: -0.1 }, /moving_average_weight/],
    [{ moving_average_weight: 1.1 }, /moving_average_weight/],
    [{ same_weekday_weight: "0.5" }, /same_weekday_weight/],
    [{ service_factor: 0 }, /service_factor/],
    [{ service_factor: -1 }, /service_factor/],
  ];

  try {
    for (const [body, pattern] of invalidCases) {
      const response = await request(app)
        .patch("/api/store/order-settings")
        .set("Authorization", `Bearer ${storeToken()}`)
        .send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.match(response.body.message, pattern, JSON.stringify(body));
    }
  } finally {
    restoreFindOne();
  }
});

test("PATCH enforces weight sum of 1", async () => {
  setStoreAuthMock();

  const instance = buildSettingsInstance();
  const restoreFindOne = overrideMethod(
    StoreOrderSetting,
    "findOne",
    async () => instance,
  );

  try {
    // 단독 변경: 현재값(0.6)과의 합이 1.1 → 거부
    const singleChange = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ moving_average_weight: 0.5 });
    assert.equal(singleChange.status, 400);
    assert.match(singleChange.body.message, /합은 1/);

    // 0으로 단독 변경: 0.4 + 0 = 0.4 → 거부
    const zeroWeight = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ same_weekday_weight: 0 });
    assert.equal(zeroWeight.status, 400);

    // 두 가중치를 함께 변경해 합이 1 → 허용
    const both = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ moving_average_weight: 0.7, same_weekday_weight: 0.3 });
    assert.equal(both.status, 200);
    assert.equal(both.body.moving_average_weight, 0.7);
    assert.equal(both.body.same_weekday_weight, 0.3);
    assert.equal(instance.saveCalls, 1);
    assert.equal(instance.movingAverageWeight, 0.7);
    assert.equal(instance.sameWeekdayWeight, 0.3);

    // 극값(1, 0)도 합이 1이면 허용
    const restoreFindOne2 = overrideMethod(
      StoreOrderSetting,
      "findOne",
      async () => buildSettingsInstance(),
    );
    try {
      const extremes = await request(app)
        .patch("/api/store/order-settings")
        .set("Authorization", `Bearer ${storeToken()}`)
        .send({ moving_average_weight: 1, same_weekday_weight: 0 });
      assert.equal(extremes.status, 200);
    } finally {
      restoreFindOne2();
    }
  } finally {
    restoreFindOne();
  }
});

test("default settings keep legacy calculation results for lead time >= forecast period", () => {
  const dailySales = seriesFrom([4, 4, 4, 4, 4, 4, 4]);
  const base = {
    dailySales,
    currentStock: 3,
    incomingQuantity: 0,
    leadTimeDays: 4,
    orderUnit: 5,
    configuredSafetyStock: 0,
  };

  const legacy = calculateRecommendation(base);
  const withDefaults = calculateRecommendation({
    ...base,
    serviceLevelZ: DEFAULT_ORDER_SETTINGS.serviceFactor,
    movingAverageDays: DEFAULT_ORDER_SETTINGS.movingAverageDays,
    forecastPeriodDays: DEFAULT_ORDER_SETTINGS.forecastPeriodDays,
    forecastWeights: {
      movingAverage: DEFAULT_ORDER_SETTINGS.movingAverageWeight,
      sameWeekday: DEFAULT_ORDER_SETTINGS.sameWeekdayWeight,
    },
  });

  assert.equal(legacy.predictedDemand, 4);
  assert.equal(withDefaults.predictedDemand, legacy.predictedDemand);
  assert.equal(withDefaults.movingAverage, legacy.movingAverage);
  assert.equal(withDefaults.sameWeekdayAverage, legacy.sameWeekdayAverage);
  assert.equal(withDefaults.computedSafetyStock, legacy.computedSafetyStock);
  assert.equal(withDefaults.targetStock, legacy.targetStock);
  assert.equal(withDefaults.orderQuantity, legacy.orderQuantity);
  assert.deepEqual(withDefaults.dataWarning, legacy.dataWarning);
  // 리드타임(4)이 예측 기간(3) 이상이면 커버리지도 기존과 동일하다.
  assert.equal(withDefaults.coverageDays, 4);
});

test("forecast period guarantees minimum coverage below lead time", () => {
  const dailySales = seriesFrom([4, 4, 4, 4, 4, 4, 4]);
  const result = calculateRecommendation({
    dailySales,
    currentStock: 3,
    incomingQuantity: 0,
    leadTimeDays: 2,
    orderUnit: 5,
    configuredSafetyStock: 0,
    forecastPeriodDays: 3,
  });

  // 커버리지 = max(리드타임 2, 예측 기간 3) = 3 → 목표재고 = ceil(4 × 3) = 12
  assert.equal(result.coverageDays, 3);
  assert.equal(result.targetStock, 12);
  assert.equal(result.orderQuantity, 10);
});

test("custom settings change the calculation inputs", () => {
  // 16일 데이터: 10-24~11-01은 2, 11-02~11-03은 8, 11-04~11-08은 6
  // 예측 대상 요일(11-09, 월요일)의 표본: 10-26(2), 11-02(8) → 동요일 평균 5
  const dailySales = seriesFrom([
    2, 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 6, 6, 6, 6, 6,
  ]);
  const base = {
    dailySales,
    currentStock: 0,
    incomingQuantity: 0,
    leadTimeDays: 4,
    orderUnit: 1,
    configuredSafetyStock: 0,
  };

  const legacy = calculateRecommendation(base);
  const custom = calculateRecommendation({
    ...base,
    serviceLevelZ: 1.8,
    movingAverageDays: 5,
    forecastPeriodDays: 3,
    forecastWeights: { movingAverage: 0.7, sameWeekday: 0.3 },
  });

  // 이동평균: 설정 5일 → 6 (기존 7일 → (8+8+6×5)/7)
  assert.ok(Math.abs(legacy.movingAverage - 46 / 7) < 1e-9);
  assert.equal(custom.movingAverage, 6);
  // 예측: 0.7 × 6 + 0.3 × 5 = 5.7 (기존 0.4 × 46/7 + 0.6 × 5)
  assert.ok(Math.abs(custom.predictedDemand - 5.7) < 1e-9);
  assert.notEqual(
    custom.predictedDemand.toFixed(6),
    legacy.predictedDemand.toFixed(6),
  );
  // 서비스 계수 1.8 > 1.65 → 표준편차 > 0 이므로 안전재고 증가 (sqrt(4) = 2)
  assert.ok(custom.dailyStdDev > 0);
  assert.ok(custom.computedSafetyStock > legacy.computedSafetyStock);
  // 리드타임 4 ≥ 예측 기간 3 → 커버리지는 동일 (4)
  assert.equal(custom.coverageDays, 4);
  assert.ok(custom.targetStock !== legacy.targetStock);
});
