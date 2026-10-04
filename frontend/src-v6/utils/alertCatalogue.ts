/** Typed internal destinations; never accept arbitrary URLs from case payloads. */
export function cataloguePath(raw: string | null | undefined, recipient = false): string | null {
  try {
    const data = JSON.parse(raw || 'null');
    if (data?.familia !== 'catalogo_verificable' || data.version !== 1) return null;
    const safe = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
    if (data.tipo === 'requerimiento_inspeccion' && safe(data.inspeccionId)) {
      return `/${recipient && data.destino === 'participacion' ? 'mis-inspecciones' : 'inspecciones'}/${data.inspeccionId}`;
    }
    if (data.tipo === 'vencimiento_documental') {
      if (recipient && data.destino === 'perfil') return '/mi-perfil';
      if (safe(data.actorId) && ['TRANSPORTISTA', 'OPERADOR'].includes(data.tipoActor)) {
        return `/admin/actores/${data.tipoActor === 'TRANSPORTISTA' ? 'transportistas' : 'operadores'}/${data.actorId}`;
      }
    }
  } catch { /* Legacy/malformed data must not invent an actionable destination. */ }
  return null;
}
