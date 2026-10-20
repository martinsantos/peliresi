import type { InspectionExchange, InspectionState } from '../../types/inspection';

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

/** Closing clears the active deadline; its original dates remain in the ledger. */
export function inspectionExchangeDeadline(state: InspectionState, active: string | null | undefined, entries: InspectionExchange[]) {
  if (active || isInspectionFollowUp(state)) return active;
  return [...entries].sort((a, b) => b.secuencia - a.secuencia)
    .find((entry) => entry.parte === 'AUTORIDAD' && entry.tipo === 'REQUERIMIENTO' && entry.plazoRespuestaAt)?.plazoRespuestaAt;
}

export function inspectionExchangeNextStep(state: InspectionState, entries: InspectionExchange[], actor: boolean) {
  if (!isInspectionFollowUp(state)) return {
    title: state === 'CERRADA_CONFORME' ? 'Seguimiento cerrado conforme' : inspectionPhaseOf(state) === 'DERIVACIONES' ? 'Intercambio concluido · expediente derivado' : 'Intercambio cerrado',
    detail: 'Podés consultar las actuaciones y los adjuntos. No se admiten nuevas presentaciones en esta instancia.',
    pending: [] as InspectionExchange[],
  };
  const requirements = entries.filter((entry) => entry.parte === 'AUTORIDAD' && entry.tipo === 'REQUERIMIENTO');
  const pending = requirements.filter((requirement) => !entries.some((entry) => entry.parte === 'INSPECCIONADO' && entry.respondeAId === requirement.id))
    .sort((a, b) => b.secuencia - a.secuencia);
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
