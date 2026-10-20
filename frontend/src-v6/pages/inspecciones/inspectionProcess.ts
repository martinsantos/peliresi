import type { InspectionExchange, InspectionFollowUp, InspectionState } from '../../types/inspection';

/** PSIP groups the existing states for navigation; it never changes a transition. */
export const INSPECTION_PHASES = {
  VISITA: { label: 'Preparación y visita', description: 'Preparar, programar, inspeccionar y revisar lo constatado.', states: ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'EN_REVISION'] },
  SEGUIMIENTO: { label: 'Seguimiento', description: 'Observaciones, plazo, descargo y acreditación de subsanación.', states: ['NOTIFICADA', 'EN_DESCARGO', 'REQUIERE_SUBSANACION'] },
  DERIVACIONES: { label: 'Derivaciones', description: 'Seguimiento de la derivación a Legales o ATM.', states: ['DERIVADA_LEGALES', 'EN_TRAMITE_LEGAL', 'DERIVADA_ATM'] },
  CERRADAS: { label: 'Cerradas', description: 'Cierre conforme, finalización o cancelación. El historial se conserva.', states: ['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'] },
} satisfies Record<string, { label: string; description: string; states: InspectionState[] }>;

export type InspectionPhase = keyof typeof INSPECTION_PHASES;
export const inspectionPhaseOf = (state: InspectionState): InspectionPhase =>
  (Object.keys(INSPECTION_PHASES) as InspectionPhase[]).find((phase) => (INSPECTION_PHASES[phase].states as InspectionState[]).includes(state))!;
export const isInspectionPhase = (value: string | null): value is InspectionPhase => Boolean(value && Object.hasOwn(INSPECTION_PHASES, value));
export const isInspectionFollowUp = (state: InspectionState) => inspectionPhaseOf(state) === 'SEGUIMIENTO';

const mendozaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' });
const deadlineFormat = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short', hour12: false });
const deadlineInputFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const deadlineTime = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity;
export const inspectionDeadlineDate = (value?: string | null) => deadlineTime(value) === Infinity ? 'Sin plazo registrado' : deadlineFormat.format(new Date(value!));
export function inspectionDeadlineStatus(value: string | null | undefined, now: number) {
  const time = deadlineTime(value);
  return time === Infinity ? 'Sin plazo registrado' : time < now ? 'Vencido' : mendozaDay.format(time) === mendozaDay.format(now) ? 'Vence hoy' : 'En plazo';
}

export function inspectionDeadlineInput(value: string): string {
  const parts = deadlineInputFormat.formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** A datetime-local has no zone: interpret the explicitly labelled Mendoza time. */
export function inspectionDeadlineFromInput(value: string): string {
  const utc = Date.parse(value + 'Z');
  const offset = Date.parse(inspectionDeadlineInput(new Date(utc).toISOString()) + 'Z') - utc;
  const result = new Date(utc - offset).toISOString();
  if (inspectionDeadlineInput(result) !== value) throw new Error('Revise la fecha y hora del plazo de respuesta.');
  return result;
}

export function inspectionFollowUpFromEntries(state: InspectionState, entries: InspectionExchange[]): InspectionFollowUp {
  if (!isInspectionFollowUp(state)) return { paso: 'CERRADO', pendientes: [] };
  const requirements = entries.filter(entry => entry.parte === 'AUTORIDAD' && entry.tipo === 'REQUERIMIENTO');
  const answered = new Set(entries.filter(entry => entry.parte === 'INSPECCIONADO' && ['RESPUESTA', 'DESCARGO', 'SUBSANACION'].includes(entry.tipo)).map(entry => entry.respondeAId));
  const pending = requirements.filter(entry => !answered.has(entry.id)).map(({ id, secuencia, plazoRespuestaAt }) => ({ id, secuencia, plazoRespuestaAt: plazoRespuestaAt || null }));
  return { paso: !requirements.length ? 'PUBLICAR' : pending.length ? 'RESPONDER' : 'REVISAR', pendientes: pending };
}

/** Dates order pending work, never an answered request or the dossier's reference date. */
export function inspectionFollowUpStatus(followUp: InspectionFollowUp | undefined, now: number) {
  const pending = [...(followUp?.pendientes || [])].sort((a, b) => {
    const left = deadlineTime(a.plazoRespuestaAt), right = deadlineTime(b.plazoRespuestaAt);
    return left === right ? b.secuencia - a.secuencia : left < right ? -1 : 1;
  });
  const overdue = pending.filter(entry => deadlineTime(entry.plazoRespuestaAt) < now).length;
  const responsible = followUp?.paso === 'RESPONDER' ? 'Inspeccionado' : followUp?.paso === 'PUBLICAR' || followUp?.paso === 'REVISAR' ? 'Autoridad' : null;
  const label = followUp?.paso === 'PUBLICAR' ? 'Autoridad: publicar requerimiento'
    : followUp?.paso === 'REVISAR' ? 'Autoridad: revisar presentación'
    : followUp?.paso === 'RESPONDER' ? `${pending.length} por responder${overdue ? ` · ${overdue} vencido${overdue === 1 ? '' : 's'}` : ''}`
    : followUp?.paso === 'CERRADO' ? 'Sin intercambio abierto' : 'Consultar comunicaciones';
  return { pending, overdue, responsible, label, next: pending[0] };
}

export function inspectionReplyDeadline(entries: InspectionExchange[], id: string): string | null {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  let entry = byId.get(id);
  while (entry) {
    if (entry.parte === 'AUTORIDAD' && entry.tipo === 'REQUERIMIENTO') return entry.plazoRespuestaAt || null;
    const parent = entry.respondeAId ? byId.get(entry.respondeAId) : undefined;
    entry = parent && parent.secuencia < entry.secuencia ? parent : undefined;
  }
  return null;
}

/** Closing clears the active deadline; its original dates remain in the ledger. */
export function inspectionExchangeDeadline(state: InspectionState, active: string | null | undefined, entries: InspectionExchange[]) {
  if (active || isInspectionFollowUp(state)) return active;
  return [...entries].sort((a, b) => b.secuencia - a.secuencia)
    .find((entry) => entry.parte === 'AUTORIDAD' && entry.tipo === 'REQUERIMIENTO' && entry.plazoRespuestaAt)?.plazoRespuestaAt;
}

export function inspectionExchangeNextStep(state: InspectionState, entries: InspectionExchange[], actor: boolean, now = Date.now()) {
  if (!isInspectionFollowUp(state)) return {
    title: state === 'CERRADA_CONFORME' ? 'Seguimiento cerrado conforme' : inspectionPhaseOf(state) === 'DERIVACIONES' ? 'Intercambio concluido · expediente derivado' : 'Intercambio cerrado',
    detail: 'Podés consultar las actuaciones y los adjuntos. No se admiten nuevas presentaciones en esta instancia.',
    pending: [] as InspectionExchange[],
  };
  const requirements = entries.filter((entry) => entry.parte === 'AUTORIDAD' && entry.tipo === 'REQUERIMIENTO');
  const pendingIds = inspectionFollowUpStatus(inspectionFollowUpFromEntries(state, entries), now).pending;
  const byId = new Map(requirements.map(entry => [entry.id, entry]));
  const pending = pendingIds.map(entry => byId.get(entry.id)!);
  if (!requirements.length) return {
    title: actor ? 'La autoridad debe publicar las observaciones' : 'Falta publicar el requerimiento',
    detail: actor ? 'Todavía no hay un pedido al que puedas responder. Consultá nuevamente cuando la autoridad lo incorpore.' : 'El estado Notificada no crea un requerimiento. Incorporá las observaciones, qué se solicita y el plazo que corresponda.', pending,
  };
  if (pending.length) return {
    title: actor ? 'Tenés requerimientos por responder' : 'A la espera del inspeccionado',
    detail: `${pending.length} ${pending.length === 1 ? 'pedido sin respuesta vinculada' : 'pedidos sin respuesta vinculada'}. ${actor ? 'Presentá tu respuesta, descargo o documentación de subsanación en el pedido correspondiente.' : 'La apertura del pedido no cuenta como respuesta ni acredita subsanación.'}`, pending,
  };
  return {
    title: actor ? 'Tu presentación está registrada' : 'Revisar las presentaciones recibidas',
    detail: actor ? 'La autoridad debe evaluar lo presentado. El envío no implica conformidad automática.' : 'Evaluá la respuesta. Podés pedir otra subsanación; el cierre conforme o la derivación requiere la decisión de la administración competente.', pending,
  };
}
