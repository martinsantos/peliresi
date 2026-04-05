export interface PaginationParams {
  page?: string | number;
  limit?: string | number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function parsePagination(
  params: PaginationParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): PaginationResult {
  const { page: defaultPage = 1, limit: defaultLimit = 20, maxLimit = 100 } = defaults;
  const page = Math.max(1, Number(params.page) || defaultPage);
  const limit = Math.min(maxLimit, Math.max(1, Number(params.limit) || defaultLimit));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}
