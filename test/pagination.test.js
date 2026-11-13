const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parsePaginationParams,
  buildPaginatedResponse,
} = require('../src/utils/pagination');

test('parsePaginationParams: 파라미터가 없으면 기본값', () => {
  assert.deepEqual(parsePaginationParams({}), { page: 1, limit: DEFAULT_PAGE_LIMIT, offset: 0 });
  assert.deepEqual(parsePaginationParams({ status: 'PENDING' }), { page: 1, limit: 20, offset: 0 });
});

test('parsePaginationParams: page/limit 파싱과 offset 계산', () => {
  assert.deepEqual(parsePaginationParams({ page: '3', limit: '10' }), { page: 3, limit: 10, offset: 20 });
  assert.deepEqual(parsePaginationParams({ page: '2' }), { page: 2, limit: 20, offset: 20 });
  assert.deepEqual(parsePaginationParams({ limit: '5' }), { page: 1, limit: 5, offset: 0 });
  assert.deepEqual(parsePaginationParams({}, { defaultLimit: 50 }), { page: 1, limit: 50, offset: 0 });
});

test('parsePaginationParams: 잘못된 값은 거부', () => {
  assert.throws(() => parsePaginationParams({ page: '0' }), /page/);
  assert.throws(() => parsePaginationParams({ page: '-1' }), /page/);
  assert.throws(() => parsePaginationParams({ page: 'abc' }), /page/);
  assert.throws(() => parsePaginationParams({ page: '1.5' }), /page/);
  assert.throws(() => parsePaginationParams({ limit: '0' }), /limit/);
  assert.throws(() => parsePaginationParams({ limit: String(MAX_PAGE_LIMIT + 1) }), /limit/);
  assert.throws(() => parsePaginationParams({ limit: 'twenty' }), /limit/);
});

test('buildPaginatedResponse: 래퍼 형식과 total_pages 계산', () => {
  assert.deepEqual(buildPaginatedResponse(['a', 'b'], 45, 2, 20), {
    items: ['a', 'b'],
    total: 45,
    page: 2,
    limit: 20,
    total_pages: 3,
  });
  assert.equal(buildPaginatedResponse([], 0, 1, 20).total_pages, 0);
  assert.equal(buildPaginatedResponse([], 1, 1, 20).total_pages, 1);
});
