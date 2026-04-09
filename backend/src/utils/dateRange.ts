import { AppError } from '../middlewares/errorHandler';

/**
 * Safely parse a date string. Returns undefined if input is null/undefined,
 * throws AppError(400) if string is present but invalid (NaN).
 *
 * Optional `endOfDay` flag bumps the time to 23:59:59.999 (for fechaFin filters
 * so they include the entire day).
 */
export function parseDateParam(value: unknown, paramName: string, endOfDay = false): Date | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new AppError(`Parametro '${paramName}' invalido: debe ser string`, 400);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new AppError(`Parametro '${paramName}' invalido: '${value}' no es una fecha valida (formato esperado: YYYY-MM-DD)`, 400);
  }
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Parse a date range from query params. Returns { gte, lte } object suitable
 * for Prisma where clauses, or undefined if both are missing.
 */
export function parseDateRange(
  fechaInicio: unknown,
  fechaFin: unknown,
  inicioName = 'fechaInicio',
  finName = 'fechaFin',
): { gte?: Date; lte?: Date } | undefined {
  const gte = parseDateParam(fechaInicio, inicioName);
  const lte = parseDateParam(fechaFin, finName, true);
  if (gte == null && lte == null) return undefined;
  const result: { gte?: Date; lte?: Date } = {};
  if (gte) result.gte = gte;
  if (lte) result.lte = lte;
  return result;
}
