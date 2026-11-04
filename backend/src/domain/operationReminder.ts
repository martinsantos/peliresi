export type ReminderModality = 'FIJO' | 'IN_SITU';
export const OPERATION_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The form records a calendar date, not a confirmed pickup time. */
export function operationReminderDate(date: Date): string {
  return date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' });
}

export function operationReminderText(modality: ReminderModality, numero: string, fecha: string) {
  return modality === 'IN_SITU'
    ? { titulo: 'Tratamiento en origen previsto', mensaje: `${numero} · Fecha prevista: ${fecha}. Revisá las aprobaciones y coordiná el inicio. No hay retiro, traslado ni GPS.` }
    : { titulo: 'Retiro previsto', mensaje: `${numero} · Fecha prevista: ${fecha}. Revisá las aprobaciones y coordiná con las partes. El viaje comienza al confirmar el retiro.` };
}
