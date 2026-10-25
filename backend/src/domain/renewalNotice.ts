/** Versioned, bounded context for new notices. Legacy notices retain their fallback. */
export type RenewalNoticeContext = {
  tipo: 'renovacion_padron'; version: 1; renovacionId: string;
  tipoActor: 'GENERADOR' | 'OPERADOR'; actorNombre: string; anio: number;
};

export const RENEWAL_NOTICE_LABELS: Record<string, readonly [string, string, string]> = {
  MODIFICACION_SOLICITADA: ['Renovación pendiente de revisión', 'Administración debe revisar la solicitud.', 'Revisar renovación'],
  MODIFICACION_APROBADA: ['Renovación aprobada', 'La administración aprobó la renovación. Consultá el resultado en tus avisos.', 'Ver resultado'],
  MODIFICACION_RECHAZADA: ['Renovación rechazada', 'Revisá el motivo de la resolución en tus avisos.', 'Ver resultado'],
};

export function validRenewalNotice(data: Record<string, unknown>): data is RenewalNoticeContext {
  return data.tipo === 'renovacion_padron' && data.version === 1
    && typeof data.renovacionId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(data.renovacionId)
    && ['GENERADOR', 'OPERADOR'].includes(String(data.tipoActor))
    && typeof data.actorNombre === 'string' && data.actorNombre.trim().length > 0 && data.actorNombre.length <= 200
    && typeof data.anio === 'number' && Number.isInteger(data.anio) && data.anio >= 2020 && data.anio <= 2100;
}

export function renewalNoticeReference(data: RenewalNoticeContext): string {
  return data.actorNombre + ' · ' + (data.tipoActor === 'GENERADOR' ? 'Generador' : 'Operador') + ' · Período ' + data.anio;
}
