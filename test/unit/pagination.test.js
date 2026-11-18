const {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parsePaginationParams,
  buildPaginatedResponse,
} = require("../../src/utils/pagination");

test("parsePaginationParams: 파라미터가 없으면 기본값", () => {
  expect(parsePaginationParams({})).toEqual({
    page: 1,
    limit: DEFAULT_PAGE_LIMIT,
    offset: 0,
  });
  expect(parsePaginationParams({ status: "PENDING" })).toEqual({
    page: 1,
    limit: 20,
    offset: 0,
  });
});

test("parsePaginationParams: page/limit 파싱과 offset 계산", () => {
  expect(parsePaginationParams({ page: "3", limit: "10" })).toEqual({
    page: 3,
    limit: 10,
    offset: 20,
  });
  expect(parsePaginationParams({ page: "2" })).toEqual({
    page: 2,
    limit: 20,
    offset: 20,
  });
  expect(parsePaginationParams({ limit: "5" })).toEqual({
    page: 1,
    limit: 5,
    offset: 0,
  });
  expect(parsePaginationParams({}, { defaultLimit: 50 })).toEqual({
    page: 1,
    limit: 50,
    offset: 0,
  });
});

test("parsePaginationParams: 잘못된 값은 거부", () => {
  expect(() => parsePaginationParams({ page: "0" })).toThrow(/page/);
  expect(() => parsePaginationParams({ page: "-1" })).toThrow(/page/);
  expect(() => parsePaginationParams({ page: "abc" })).toThrow(/page/);
  expect(() => parsePaginationParams({ page: "1.5" })).toThrow(/page/);
  expect(() => parsePaginationParams({ limit: "0" })).toThrow(/limit/);
  expect(
    () => parsePaginationParams({ limit: String(MAX_PAGE_LIMIT + 1) })
  ).toThrow(
    /limit/
  );
  expect(() => parsePaginationParams({ limit: "twenty" })).toThrow(/limit/);
});

test("buildPaginatedResponse: 래퍼 형식과 total_pages 계산", () => {
  expect(buildPaginatedResponse(["a", "b"], 45, 2, 20)).toEqual({
    items: ["a", "b"],
    total: 45,
    page: 2,
    limit: 20,
    total_pages: 3,
  });
  expect(buildPaginatedResponse([], 0, 1, 20).total_pages).toBe(0);
  expect(buildPaginatedResponse([], 1, 1, 20).total_pages).toBe(1);
});
