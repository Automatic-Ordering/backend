const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

const parsePaginationParams = (
  query,
  { defaultLimit = DEFAULT_PAGE_LIMIT, maxLimit = MAX_PAGE_LIMIT } = {},
) => {
  const pageRaw = query?.page;
  const limitRaw = query?.limit;

  if (
    pageRaw !== undefined &&
    (typeof pageRaw !== "string" ||
      !/^\d+$/.test(pageRaw) ||
      Number(pageRaw) < 1)
  ) {
    throw new Error("page는 1 이상의 정수여야 합니다.");
  }

  if (
    limitRaw !== undefined &&
    (typeof limitRaw !== "string" ||
      !/^\d+$/.test(limitRaw) ||
      Number(limitRaw) < 1 ||
      Number(limitRaw) > maxLimit)
  ) {
    throw new Error(`limit는 1 이상 ${maxLimit} 이하의 정수여야 합니다.`);
  }

  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const limit = limitRaw === undefined ? defaultLimit : Number(limitRaw);
  return { page, limit, offset: (page - 1) * limit };
};

const buildPaginatedResponse = (items, total, page, limit) => ({
  items,
  total,
  page,
  limit,
  total_pages: Math.ceil(total / limit),
});

module.exports = {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parsePaginationParams,
  buildPaginatedResponse,
};
