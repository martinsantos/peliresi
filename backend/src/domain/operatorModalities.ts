import { AppError } from '../middlewares/errorHandler';

/** Exact current form options only; legacy text never implies a new permission. */
export function operatorModalitiesForType(value: unknown): Array<'FIJO' | 'IN_SITU'> | undefined {
  return value === 'FIJO' ? ['FIJO'] : value === 'IN_SITU' ? ['IN_SITU'] : undefined;
}
export function approvedOperatorModeChange(current: { tipoOperador?: string | null }, proposed: unknown, administrator: boolean) {
  if (proposed === undefined || proposed === current.tipoOperador) return {};
  if (!administrator) throw new AppError('El cambio de modalidad requiere revisión administrativa', 403);
  const modalidades = operatorModalitiesForType(proposed);
  return modalidades ? { modalidades } : {};
}
