/** Mirrors the initial-credential contract enforced by actor.controller.
 * Editing an actor does not call this validator or change its credentials. */
export function initialPasswordError(password: string, cuit: string): string | undefined {
  if (password.length < 8 || !password.trim()) {
    return 'La contraseña inicial es obligatoria y debe tener al menos 8 caracteres';
  }
  if (/^[\d\s-]+$/.test(password) && password.replace(/\D/g, '') === cuit.replace(/\D/g, '')) {
    return 'La contraseña inicial no puede ser el CUIT';
  }
  return undefined;
}

export function vehicleCapacityError(value: string): string | undefined {
  const capacity = Number(value);
  return !value.trim() || !Number.isFinite(capacity) || capacity <= 0
    ? 'La capacidad debe ser un número mayor que cero, en kg'
    : undefined;
}

export const COORDINATE_ERROR = 'Indicá latitud y longitud válidas, separadas por coma. Ejemplo: -32.89, -68.83';
/** undefined = not supplied; null = invalid; zero remains a real coordinate. */
export function parseActorCoordinates(value: string): { latitud: number; longitud: number } | null | undefined {
  if (!value.trim()) return undefined;
  const parts = value.split(',').map(part => part.trim());
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  if (parts.length !== 2 || !parts.every(part => decimal.test(part))) return null;
  const [latitud, longitud] = parts.map(Number);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
  return { latitud, longitud };
}
