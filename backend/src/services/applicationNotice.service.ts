const ACTIVITY: Record<string, string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' };
export const APPLICATION_NOTICE_LABELS: Record<string, [string, string]> = {
  SOLICITUD_ENVIADA: ['Inscripción presentada', 'La inscripción está presentada para revisión. Consultá los datos y documentos del trámite.'],
  SOLICITUD_OBSERVADA: ['Inscripción observada', 'Revisá las observaciones y corregí lo solicitado en el trámite.'],
  SOLICITUD_MENSAJE: ['Nuevo mensaje en la inscripción', 'Abrí el trámite para leer el mensaje y responder.'],
  SOLICITUD_APROBADA: ['Inscripción aprobada', 'La administración aprobó esta actividad. Consultá el resultado en el trámite.'],
  SOLICITUD_RECHAZADA: ['Inscripción rechazada', 'Consultá el motivo de la resolución en el trámite.'],
};
function validReference(kind: string, data: any): boolean {
  return Object.prototype.hasOwnProperty.call(APPLICATION_NOTICE_LABELS, kind) && typeof data?.solicitudId === 'string'
    && /^[a-zA-Z0-9_-]{1,100}$/.test(data.solicitudId);
}
/** No observation, message, document or rejection reason is copied to mail. */
export function applicationNoticeMessage(kind: string, data: any): [string, string] | undefined {
  if (!validReference(kind, data) || !Object.prototype.hasOwnProperty.call(ACTIVITY, String(data.tipoActor))) return undefined;
  const [title, body] = APPLICATION_NOTICE_LABELS[kind];
  const applicant = typeof data.solicitante === 'string' ? data.solicitante.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  return [title + ' · ' + ACTIVITY[data.tipoActor], (applicant ? applicant + '. ' : '') + body];
}
export function applicationNoticeContent(kind: string, application: { id: string; tipoActor: string; usuario?: { nombre: string } }) {
  const data = { tipo: kind.toLowerCase(), solicitudId: application.id, tipoActor: application.tipoActor, ...(application.usuario?.nombre ? { solicitante: application.usuario.nombre } : {}) };
  const content = applicationNoticeMessage(kind, data);
  if (!content) throw new Error('Invalid application notice reference');
  return { titulo: content[0], mensaje: content[1], datos: JSON.stringify(data) };
}
/** Own-account notifications only. Batch historical references, retain original
 * rows and private content there; project controlled context in the response. */
export async function withApplicationNoticeContext<T extends { tipo: string; datos: string | null }>(db: any, notices: T[]): Promise<T[]> {
  const references = notices.map(n => {
    try { const d = JSON.parse(n.datos || 'null'); return validReference(n.tipo, d) ? d : null; } catch { return null; }
  });
  const ids = [...new Set(references.filter(d => d && (!Object.prototype.hasOwnProperty.call(ACTIVITY, String(d.tipoActor)) || typeof d.solicitante !== 'string')).map(d => d.solicitudId))];
  const applications = ids.length ? await db.solicitudInscripcion.findMany({ where: { id: { in: ids } }, select: { id: true, tipoActor: true, usuario: { select: { nombre: true } } } }) : [];
  const records = new Map<string, any>(applications.map((a: any) => [a.id, a]));
  return notices.map((notice, index) => {
    const original = references[index];
    if (!original) return notice;
    const record = records.get(original.solicitudId);
    const data = { ...original, tipoActor: Object.prototype.hasOwnProperty.call(ACTIVITY, String(original.tipoActor)) ? original.tipoActor : record?.tipoActor,
      ...(!original.solicitante && record?.usuario?.nombre ? { solicitante: record.usuario.nombre } : {}) };
    const content = applicationNoticeMessage(notice.tipo, data);
    return content ? { ...notice, titulo: content[0], mensaje: content[1], datos: JSON.stringify(data) } : notice;
  });
}
