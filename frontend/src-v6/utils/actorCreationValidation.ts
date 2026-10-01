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
