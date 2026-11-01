import type { PartyApproval } from '../components/PartyApprovalStatus';

/** Presentation only. Server permissions and workflow guards remain authoritative. */
export type ManifestWork = {
  estado?: string;
  modalidad?: string;
  partes?: PartyApproval[] | null;
  inicio?: string | null;
  requiereMiAprobacion?: boolean;
  requiereNuevaPropuesta?: boolean;
  requiereRevisionPropuesta?: boolean;
  puedeIniciar?: boolean;
  pesajePendiente?: boolean;
  pesajeNoDisponible?: boolean;
  rechazo?: string | null;
  finalEmitido?: boolean;
};
export const partyNames: Record<string, string> = {
  GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador',
};
const requiredParties = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const;

/** Network data is not guaranteed to match its TypeScript declaration. Do not
 * turn an absent, duplicated or non-boolean decision into an approval. */
export function validPartyStatuses(value: unknown): value is PartyApproval[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > requiredParties.length) return false;
  const seen = new Set<string>();
  return value.every(part => {
    if (!part || typeof part !== 'object' || typeof part.rol !== 'string' ||
        !requiredParties.includes(part.rol as typeof requiredParties[number]) || typeof part.aprobada !== 'boolean' || seen.has(part.rol)) return false;
    seen.add(part.rol); return true;
  });
}
export function hasThreePartyStatuses(value: unknown): value is PartyApproval[] {
  return validPartyStatuses(value) && value.length === requiredParties.length;
}
/** The API sends null before coordination and an ISO instant afterwards. */
export function validCoordinationTime(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
}
export function approvalSummary(partes: PartyApproval[]) {
  return `${partes.filter(p => p.aprobada).length} de ${partes.length} aprobaciones`;
}
export function rejectionReason(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'motivo' in parsed && typeof parsed.motivo === 'string') return parsed.motivo;
  } catch { /* Older records may contain plain text. */ }
  return value;
}
export function manifestWork(m: ManifestWork, role: string) {
  const inSitu = m.modalidad === 'IN_SITU';
  const completeParties = hasThreePartyStatuses(m.partes);
  const missing = completeParties ? requiredParties.filter(role => !m.partes?.some(part => part.rol === role && part.aprobada)).map(role => partyNames[role]) : [];
  const result = (label: string, responsible: string, detail: string, tone: 'pending' | 'active' | 'done' | 'blocked' = 'active') => ({ label, responsible, detail, tone });
  if (m.requiereRevisionPropuesta) return result('Propuesta por revisar', 'Ambiente', 'No se pueden comprobar las aprobaciones. Contactá a Ambiente; el historial se conserva y no se puede iniciar.', 'blocked');
  if (m.rechazo) return result('Propuesta detenida', 'Partes vinculadas', 'Hay una participación rechazada. Revisá el motivo antes de preparar otra propuesta.', 'blocked');
  if (m.requiereNuevaPropuesta) return result('Necesita nueva propuesta', 'Partes vinculadas', 'Creá una nueva propuesta con las tres partes; el registro anterior se conserva.', 'blocked');
  if (['PENDIENTE_APROBACION', 'APROBADO'].includes(m.estado || '') && !completeParties) return result('Revisar aprobaciones', 'Ambiente', 'No se pueden comprobar las tres aprobaciones. Abrí y actualizá el manifiesto; si continúa el problema, consultá a Ambiente.', 'blocked');
  if (['PENDIENTE_APROBACION', 'APROBADO'].includes(m.estado || '') && !validCoordinationTime(m.inicio)) return result('Revisar aprobaciones', 'Ambiente', 'No se pudo comprobar la coordinación. Abrí y actualizá el manifiesto; si continúa el problema, consultá a Ambiente.', 'blocked');
  if (m.estado === 'PENDIENTE_APROBACION' && (m.inicio !== null || !missing.length || (m.requiereMiAprobacion && !m.partes?.some(part => part.rol === role && !part.aprobada)))) return result('Revisar aprobaciones', 'Ambiente', 'El estado no coincide con las decisiones registradas. Actualizá el manifiesto y, si continúa el problema, consultá a Ambiente.', 'blocked');
  if (m.estado === 'APROBADO' && missing.length) return result('Revisar aprobaciones', missing.join(', '), 'No se puede iniciar hasta comprobar todas las aprobaciones.', 'blocked');
  if (m.estado === 'RECIBIDO' && (m.pesajeNoDisponible || typeof m.pesajePendiente !== 'boolean')) return result('Pesaje por comprobar', 'Operador', 'No pudimos comprobar el pesaje. Actualizá el manifiesto y, si el problema continúa, consultá a Ambiente.', 'blocked');
  switch (m.estado) {
    case 'BORRADOR': return result('Necesita nueva propuesta', 'Partes vinculadas', 'El borrador anterior se conserva; se necesitan las tres aprobaciones antes de iniciar.', 'blocked');
    case 'PENDIENTE_APROBACION': return result(m.requiereMiAprobacion ? 'Te toca aprobar' : 'En espera', missing.join(', ') || 'Partes vinculadas', m.requiereMiAprobacion ? 'Revisá los datos antes de confirmar tu participación.' : 'Cada parte pendiente debe aprobar desde su cuenta. El retiro todavía no está habilitado.', 'pending');
    case 'APROBADO':
      if (m.partes && !m.inicio) {
        const canStart = requiredParties.includes(role as typeof requiredParties[number]) && m.puedeIniciar !== false;
        return result('Listo para iniciar', 'Cualquiera de las partes vinculadas', inSitu
          ? canStart ? 'Coordiná la recepción en origen con la otra parte. No hay viaje ni GPS.' : 'Una de las partes debe iniciar la coordinación de la recepción en origen. No hay viaje ni GPS.'
          : canStart ? 'Iniciá la coordinación cuando acuerden la operación. Todavía no comienza el viaje.' : 'Una de las partes debe iniciar la coordinación. Todavía no comienza el viaje.');
      }
      return result(inSitu ? (role === 'OPERADOR' ? 'Confirmar recepción en origen' : 'Esperando recepción en origen') : role === 'TRANSPORTISTA' ? 'Confirmar retiro' : 'Preparando retiro', inSitu ? 'Operador' : 'Transporte', inSitu ? 'El operador confirma la recepción en origen. No hay viaje ni GPS.' : 'El transporte confirma el retiro cuando recibe la carga. En ese momento comienza el viaje y el GPS.');
    case 'EN_TRANSITO': return result('En viaje · GPS', 'Transporte', role === 'TRANSPORTISTA' ? 'Compartí la ubicación durante el viaje y confirmá la entrega al llegar.' : 'El transporte comparte la ubicación y confirma la entrega al llegar.');
    case 'ENTREGADO': return result(role === 'OPERADOR' ? 'Confirmar recepción' : 'Esperando recepción', 'Operador', role === 'OPERADOR' ? 'Comprobá la carga recibida. Las diferencias se documentan en una adenda con informe de hallazgo.' : 'El operador comprueba la carga recibida y documenta las diferencias en una adenda con informe de hallazgo.');
    case 'RECIBIDO': return result(role === 'OPERADOR' ? (m.pesajePendiente ? 'Registrar pesaje' : 'Registrar tratamiento') : 'En recepción', 'Operador', role === 'OPERADOR' ? (m.pesajePendiente ? 'Registrá las cantidades realmente recibidas antes del tratamiento.' : 'Registrá el tratamiento aplicado a los residuos recibidos.') : (m.pesajePendiente ? 'El operador registra las cantidades realmente recibidas antes del tratamiento.' : 'El operador registra el tratamiento aplicado a los residuos recibidos.'));
    case 'EN_TRATAMIENTO': return result('En tratamiento', 'Operador', role === 'OPERADOR' ? 'Podés emitir parciales de lo tratado. Cerrá el manifiesto cuando termine el tratamiento.' : 'El operador puede emitir parciales de lo tratado y cerrar el manifiesto al finalizar el tratamiento.');
    case 'TRATADO': return m.finalEmitido ? result('Certificación final emitida', 'Partes vinculadas', 'El documento está disponible en Certificaciones.', 'done') : result(role === 'OPERADOR' ? 'Emitir certificación final' : 'Esperando certificado final', 'Operador', 'El cierre no emite el certificado. El operador lo firma cuando todas las adendas estén resueltas.', 'pending');
    case 'CANCELADO': return result('Manifiesto cancelado', 'Sin acción pendiente', 'Se conserva el historial de la operación.', 'done');
    case 'RECHAZADO': return result('Carga rechazada', 'Partes vinculadas', 'Revisá el motivo del rechazo y coordiná la resolución con las partes.', 'blocked');
    default: return result('Estado por verificar', 'Administración', 'Actualizá el manifiesto para comprobar cómo continuar.', 'blocked');
  }
}
