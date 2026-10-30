/** A link only chooses an owned notice, never an actor or company authority. */
export function personalManifestNotice(tipo: string, data: Record<string, unknown>, manifestId: string | null | undefined): boolean {
  if (typeof manifestId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(manifestId)
    || ['relevo_transporte', 'manifiesto_eventual'].includes(String(data.tipo))) return false;
  return ['propuesta_partes', 'adenda_manifiesto', 'ADENDA_POST_FACTO', 'certificado_manifiesto', 'estado_manifiesto',
    'reversion_manifiesto', 'alerta_evento_manifiesto', 'duracion_transito_configurada', 'alerta_regla_manifiesto',
    'recordatorio_firma', 'recordatorio_operacion'].includes(String(data.tipo))
    || ['MANIFIESTO_FIRMADO', 'MANIFIESTO_EN_TRANSITO', 'MANIFIESTO_ENTREGADO', 'MANIFIESTO_RECIBIDO',
      'MANIFIESTO_TRATADO', 'MANIFIESTO_RECHAZADO'].includes(tipo);
}
