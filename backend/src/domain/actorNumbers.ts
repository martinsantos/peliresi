import { AppError } from '../middlewares/errorHandler';

/** Unknown is not zero. Validate before persisting or hashing a transaction. */
export function actorNumber(value: unknown, label: string, maximum?: number): number | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))) throw new AppError(`${label}: indicá un número válido`, 400);
  const number = Number(value);
  if (!Number.isFinite(number) || (maximum !== undefined && Math.abs(number) > maximum)) throw new AppError(`${label}: número fuera de rango`, 400);
  return number;
}
export function actorCoordinates(latitud: unknown, longitud: unknown): { latitud?: number | null; longitud?: number | null } {
  const lat = actorNumber(latitud, 'Latitud', 90), lon = actorNumber(longitud, 'Longitud', 180);
  return { ...(lat !== undefined ? { latitud: lat } : {}), ...(lon !== undefined ? { longitud: lon } : {}) };
}
