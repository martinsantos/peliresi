/** Presentation only: persisted event codes remain unchanged for workflow and audit. */
const labels: Record<string, string> = {
  CREACION: 'Manifiesto creado', FIRMA: 'Firma del generador', RETIRO: 'Retiro confirmado',
  ENTREGA: 'Entrega confirmada', RECEPCION: 'Recepción confirmada', RECEPCION_IN_SITU: 'Recepción in situ',
  PESAJE: 'Pesaje registrado', TRATAMIENTO: 'Tratamiento registrado', CIERRE: 'Tratamiento cerrado',
  INCIDENTE: 'Incidente registrado', CANCELACION: 'Manifiesto cancelado', RECHAZO: 'Carga rechazada',
  REVERSION: 'Estado rectificado', ASIGNACION_TRANSPORTE: 'Transporte asignado',
  ASIGNACION_TRANSPORTE_RETIRADA: 'Asignación retirada', RELEVO_TRANSPORTE: 'Relevo registrado',
  ACCESO_RELEVO: 'Acceso del relevo actualizado', PROPUESTA_PARTES_V1: 'Propuesta a las tres partes',
  APROBACION_TRANSPORTISTA: 'Transporte aprobó', APROBACION_OPERADOR: 'Operador aprobó',
  RECHAZO_PARTE: 'Participación rechazada', INICIO_COORDINACION: 'Coordinación iniciada',
  INICIO_COORDINACION_CAP: 'Coordinación iniciada',
  CERTIFICACION_ENVIO_RETIRADO: 'Solicitud de certificación retirada sin emitir',
  CERTIFICACION_OPERADOR_V1: 'Gestión de certificados configurada',
  CERTIFICADO_OPERADOR_V1: 'Certificado emitido', CERTIFICADO_CAP_V1: 'Certificado de práctica emitido',
};
export function manifestEventLabel(type?: string | null): string {
  return labels[type || ''] || 'Actividad registrada';
}

const roles: Record<string, string> = { GENERADOR: 'El generador', TRANSPORTISTA: 'El transporte', OPERADOR: 'El operador', ADMIN: 'La administración' };
export function manifestEventDescription(type: string | undefined, description?: string | null): string {
  if (type === 'CERTIFICACION_OPERADOR_V1') return 'El operador podrá emitir y firmar certificados cuando se cumplan las condiciones. Este evento no es un certificado emitido.';
  const text = description?.trim() || '';
  if (!text) return manifestEventLabel(type);
  if (!/^[{[]/.test(text)) return text; // Historical prose is preserved.
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (type === 'PROPUESTA_PARTES_V1') return `${roles[value.autorRol] || 'Una de las partes'} presentó la propuesta. Requiere la aprobación de generador, transporte y operador.`;
      if (['CERTIFICADO_OPERADOR_V1', 'CERTIFICADO_CAP_V1'].includes(type || '')) {
        const kind = value.tipo === 'FINAL' ? 'Certificación final total' : value.tipo === 'PARCIAL' ? 'Certificación parcial' : 'Certificado';
        return `${kind}${typeof value.numero === 'string' ? ' ' + value.numero : ''} ${kind === 'Certificado' ? 'emitido' : 'emitida'} por el operador.${type === 'CERTIFICADO_CAP_V1' ? ' Sin validez oficial.' : ''}`;
      }
      if (value.version === 1 && roles[value.rol] && ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR', 'RECHAZO_PARTE'].includes(type || '')) {
        if (value.decision === 'RECHAZADA') return `${roles[value.rol]} rechazó su participación${typeof value.motivo === 'string' ? ': ' + value.motivo : '.'}`;
        if (value.decision === 'APROBADA') return `${roles[value.rol]} aprobó su participación.`;
      }
    }
  } catch { /* Malformed structured metadata must not become a technical label. */ }
  return 'Actividad registrada en el historial del manifiesto.';
}
