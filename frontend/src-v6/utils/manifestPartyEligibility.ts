import type { CatalogoItem } from '../types/api';
export const manifestPartyFields = ['generador', 'transportista', 'operador'] as const;
export type ManifestPartyField = typeof manifestPartyFields[number];
export function partyApprovalMessage(actor?: CatalogoItem): string | undefined {
  return actor?.aprobacionManifiesto?.habilitada === false ? actor.aprobacionManifiesto.mensaje || 'Actualizá los estados de este actor antes de continuar.' : undefined;
}
export function partyApprovalSuffix(actor: CatalogoItem): string {
  const reason = actor.aprobacionManifiesto?.motivo;
  const labels = { ACTOR_NO_ENCONTRADO: 'No disponible', ACTOR_INACTIVO: 'Actor inactivo', SIN_CUENTA: 'Sin cuenta vinculada', CUENTA_INACTIVA: 'Cuenta inactiva' };
  return reason ? ` · ${labels[reason]}` : '';
}
/** Accept only explicit field guidance, never internal details or arbitrary keys. */
export function manifestPartyErrors(error: unknown): Partial<Record<ManifestPartyField, string>> {
  const response = (error as { response?: { status?: number; data?: { fieldErrors?: unknown } } } | null)?.response;
  const fields = response?.data?.fieldErrors;
  if (response?.status !== 400 || !fields || typeof fields !== 'object') return {};
  return Object.fromEntries(manifestPartyFields.flatMap(field => {
    const message = (fields as Record<string, unknown>)[field];
    return typeof message === 'string' && message.trim() ? [[field, message]] : [];
  }));
}
