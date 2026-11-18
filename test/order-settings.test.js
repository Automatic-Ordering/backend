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
  expect(unauthorized.statusCode).toBe(401);

  setAdminAuthMock();
  const adminOnStore = await request(app)
    .get("/api/store/order-settings")
    .set("Authorization", `Bearer ${adminToken()}`);
  expect(adminOnStore.statusCode).toBe(403);
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

    expect(response.statusCode).toBe(200);
    expect(findOneCalls[0].where.storeId).toBe(1);
    expect(response.body.store_id).toBe(1);
    expect(response.body.analysis_period_days).toBe(90);
    expect(response.body.moving_average_days).toBe(7);
    expect(response.body.moving_average_weight).toBe(0.4);
    expect(response.body.same_weekday_weight).toBe(0.6);
    expect(response.body.service_factor).toBe(1.65);
    expect(response.body.forecast_period_days).toBe(3);
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

    expect(response.statusCode).toBe(200);
    expect(createCalls.length).toBe(1);
    expect(createCalls[0].storeId).toBe(1);
    expect(
      {
        analysisPeriodDays: createCalls[0].analysisPeriodDays,
        movingAverageDays: createCalls[0].movingAverageDays,
        movingAverageWeight: createCalls[0].movingAverageWeight,
        sameWeekdayWeight: createCalls[0].sameWeekdayWeight,
        serviceFactor: createCalls[0].serviceFactor,
        forecastPeriodDays: createCalls[0].forecastPeriodDays,
      }
    ).toEqual(
      DEFAULT_ORDER_SETTINGS
    );
    expect(response.body.analysis_period_days).toBe(120);
    expect(response.body.moving_average_days).toBe(7);
    expect(response.body.moving_average_weight).toBe(0.4);
    expect(response.body.same_weekday_weight).toBe(0.6);
    expect(response.body.service_factor).toBe(1.65);
    expect(response.body.forecast_period_days).toBe(3);
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
      expect(args.where.storeId).toBe(1);
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

    expect(response.statusCode).toBe(200);
    expect(response.body.analysis_period_days).toBe(90);
    expect(response.body.service_factor).toBe(1.8);
    expect(response.body.forecast_period_days).toBe(5);
    expect(instance.saveCalls).toBe(1);
    // PATCH 본문에 store_id를 넣어도 토큰 점포만 수정 대상이 된다.
    expect(instance.storeId).toBe(1);
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
    expect(otherStore.statusCode).toBe(400);
    expect(otherStore.body.message).toMatch(/store_id/);

    const unknown = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ mystery_field: 1 });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.body.message).toMatch(/mystery_field/);

    const empty = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({});
    expect(empty.statusCode).toBe(400);
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
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(pattern);
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
    expect(singleChange.statusCode).toBe(400);
    expect(singleChange.body.message).toMatch(/합은 1/);

    // 0으로 단독 변경: 0.4 + 0 = 0.4 → 거부
    const zeroWeight = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ same_weekday_weight: 0 });
    expect(zeroWeight.statusCode).toBe(400);

    // 두 가중치를 함께 변경해 합이 1 → 허용
    const both = await request(app)
      .patch("/api/store/order-settings")
      .set("Authorization", `Bearer ${storeToken()}`)
      .send({ moving_average_weight: 0.7, same_weekday_weight: 0.3 });
    expect(both.statusCode).toBe(200);
    expect(both.body.moving_average_weight).toBe(0.7);
    expect(both.body.same_weekday_weight).toBe(0.3);
    expect(instance.saveCalls).toBe(1);
    expect(instance.movingAverageWeight).toBe(0.7);
    expect(instance.sameWeekdayWeight).toBe(0.3);

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
      expect(extremes.statusCode).toBe(200);
    } finally {
      restoreFindOne2();
    }
  } finally {
    restoreFindOne();
  }
});

test("점포 설정값(이동평균 기간/가중치/예측 기간)은 발주 계산에 반영되지 않는다", () => {
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

  expect(legacy.predictedDemand).toBe(4);
  expect(withDefaults.predictedDemand).toBe(legacy.predictedDemand);
  expect(withDefaults.movingAverage).toBe(legacy.movingAverage);
  expect(withDefaults.targetStock).toBe(legacy.targetStock);
  expect(withDefaults.orderQuantity).toBe(legacy.orderQuantity);
  expect(withDefaults.dataWarning).toEqual(legacy.dataWarning);
  // 예측 기간은 1일로 고정되어 설정값과 무관하다.
  expect(withDefaults.coverageDays).toBe(1);
  expect(legacy.coverageDays).toBe(1);
});

test("예측 기간은 1일로 고정된다 (설정값을 전달해도 무시된다)", () => {
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

  // 커버리지 = 예측 기간 1일 고정 → 목표재고 = ceil(4 × 1) = 4
  expect(result.coverageDays).toBe(1);
  expect(result.forecastPeriodDays).toBe(1);
  expect(result.targetStock).toBe(4);
  expect(result.orderQuantity).toBe(5);
});

test("커스텀 설정을 전달해도 발주 계산은 7일 이동평균·1일 고정으로 동일하다", () => {
  // 16일 데이터: 마지막 7일은 8, 8, 6, 6, 6, 6, 6 → 이동평균 46/7
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

  // 이동평균 기간/가중치/예측 기간 설정은 계산에 반영되지 않는다.
  expect(legacy.movingAverage).toBeCloseTo(46 / 7, 9);
  expect(custom.movingAverage).toBeCloseTo(46 / 7, 9);
  expect(custom.predictedDemand).toBeCloseTo(46 / 7, 9);
  expect(custom.sameWeekdayAverage).toBeNull();
  expect(custom.coverageDays).toBe(1);
  expect(custom.targetStock).toBe(legacy.targetStock);
  expect(custom.orderQuantity).toBe(legacy.orderQuantity);
  // 서비스 계수는 참고용 computed_safety_stock에만 영향을 준다.
  expect(custom.dailyStdDev).toBeGreaterThan(0);
  expect(custom.computedSafetyStock).toBeGreaterThan(legacy.computedSafetyStock);
});
