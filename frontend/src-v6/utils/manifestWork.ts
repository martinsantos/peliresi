import type { PartyApproval } from '../components/PartyApprovalStatus';

/** Presentation only. Server permissions and workflow guards remain authoritative. */
export type ManifestWork = {
  estado?: string;
  modalidad?: string;
  partes?: PartyApproval[] | null;
  inicio?: string | null;
  requiereMiAprobacion?: boolean;
  pesajePendiente?: boolean;
  rechazo?: string | null;
  finalEmitido?: boolean;
};
export const partyNames: Record<string, string> = {
  GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador',
};
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
  const missing = m.partes?.filter(p => !p.aprobada).map(p => partyNames[p.rol] || p.rol) || [];
  const result = (label: string, responsible: string, detail: string, tone: 'pending' | 'active' | 'done' | 'blocked' = 'active') => ({ label, responsible, detail, tone });
  if (m.rechazo) return result('Propuesta detenida', 'Partes vinculadas', 'Hay una participación rechazada. Revisá el motivo antes de preparar otra propuesta.', 'blocked');
  if (m.estado === 'APROBADO' && m.partes && (!m.partes.length || missing.length)) return result('Revisar aprobaciones', missing.join(', ') || 'Administración', 'No se puede iniciar hasta comprobar todas las aprobaciones.', 'blocked');
  switch (m.estado) {
    case 'BORRADOR': return result('Borrador · firma del generador pendiente', 'Generador', 'Revisá y firmá el borrador para continuar.', 'pending');
    case 'PENDIENTE_APROBACION': return result(m.requiereMiAprobacion ? 'Te toca aprobar' : 'En espera', missing.join(', ') || 'Partes vinculadas', m.requiereMiAprobacion ? 'Revisá los datos antes de confirmar tu participación.' : 'Cada parte pendiente debe aprobar desde su cuenta. El retiro todavía no está habilitado.', 'pending');
    case 'APROBADO':
      if (m.partes && !m.inicio) return result('Listo para iniciar', 'Cualquiera de las partes vinculadas', inSitu ? 'Coordiná la recepción en origen con la otra parte. No hay viaje ni GPS.' : 'Iniciá la coordinación cuando acuerden la operación. Todavía no comienza el viaje.');
      return result(inSitu ? (role === 'OPERADOR' ? 'Confirmar recepción en origen' : 'Esperando recepción en origen') : role === 'TRANSPORTISTA' ? 'Confirmar retiro' : 'Preparando retiro', inSitu ? 'Operador' : 'Transporte', inSitu ? 'El operador confirma la recepción en origen. No hay viaje ni GPS.' : 'El transporte confirma el retiro cuando recibe la carga. En ese momento comienza el viaje y el GPS.');
    case 'EN_TRANSITO': return result('En viaje · GPS', 'Transporte', role === 'TRANSPORTISTA' ? 'Compartí la ubicación durante el viaje y confirmá la entrega al llegar.' : 'El transporte comparte la ubicación y confirma la entrega al llegar.');
    case 'ENTREGADO': return result(role === 'OPERADOR' ? 'Confirmar recepción' : 'Esperando recepción', 'Operador', 'Comprobá la carga recibida. Las diferencias se documentan en una adenda con informe de hallazgo.');
    case 'RECIBIDO': return result(role === 'OPERADOR' ? (m.pesajePendiente ? 'Registrar pesaje' : 'Registrar tratamiento') : 'En recepción', 'Operador', m.pesajePendiente ? 'Registrá las cantidades realmente recibidas antes del tratamiento.' : 'Registrá el tratamiento aplicado a los residuos recibidos.');
    case 'EN_TRATAMIENTO': return result('En tratamiento', 'Operador', 'Podés emitir parciales de lo tratado. Cerrá el manifiesto cuando termine el tratamiento.');
    case 'TRATADO': return m.finalEmitido ? result('Certificación final emitida', 'Partes vinculadas', 'El documento está disponible en Certificaciones.', 'done') : result(role === 'OPERADOR' ? 'Emitir certificación final' : 'Esperando certificado final', 'Operador', 'El cierre no emite el certificado. El operador lo firma cuando todas las adendas estén resueltas.', 'pending');
    case 'CANCELADO': return result('Manifiesto cancelado', 'Sin acción pendiente', 'Se conserva el historial de la operación.', 'done');
    case 'RECHAZADO': return result('Carga rechazada', 'Partes vinculadas', 'Revisá el motivo del rechazo y coordiná la resolución con las partes.', 'blocked');
    default: return result('Estado por verificar', 'Administración', 'Actualizá el manifiesto para comprobar cómo continuar.', 'blocked');
  }
}
