/**
 * Utilidades de paginación para proteger el servidor
 * Previene queries masivas que podrían agotar la memoria
 */

export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,  // Límite máximo absoluto
  MIN_LIMIT: 1
} as const;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Parsea y valida parámetros de paginación
 * Protege contra valores inválidos o excesivos
 */
export function parsePagination(
  pageParam?: string | number,
  limitParam?: string | number,
  maxLimit: number = PAGINATION_DEFAULTS.MAX_LIMIT
): PaginationParams {
  // Parsear página
  let page = Number(pageParam) || PAGINATION_DEFAULTS.DEFAULT_PAGE;
  if (page < 1) page = 1;

  // Parsear límite con protección
  let limit = Number(limitParam) || PAGINATION_DEFAULTS.DEFAULT_LIMIT;
  if (limit < PAGINATION_DEFAULTS.MIN_LIMIT) limit = PAGINATION_DEFAULTS.MIN_LIMIT;
  if (limit > maxLimit) limit = maxLimit;

  // Calcular skip
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Construye objeto de paginación para response
 */
export function buildPaginationResult(
  page: number,
  limit: number,
  total: number
): PaginationResult {
  const pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1
  };
}
