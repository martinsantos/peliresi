import { z } from 'zod';
import { hashCanonicalPayload } from '../services/inspectionDocumentIntegrity.service';

/** Only field content is signable. No internal reports, exchanges or private event metadata. */
export function inspectionSignatureSnapshot(i: any): any {
  const { firmaIntervinienteEstado, firmaIntervinienteDetalle, copiaActaEstado, copiaActaDetalle, notificacionEstado, notificacionDetalle, ...act } = i.datosActa || {};
  const evidencias = (i.evidencias || []).filter((e: any) => !e.intercambioId && !e.anuladaAt && e.tipo === 'FOTO').map((e: any) => ({
    id: e.id, tipo: e.tipo, nombreOriginal: e.nombreOriginal, mimeDetectado: e.mimeDetectado, bytes: e.bytes,
    sha256: e.sha256, descripcion: e.descripcion, capturadaAt: e.capturadaAt, createdAt: e.createdAt,
    latitud: e.latitud, longitud: e.longitud, itemId: e.itemId, comparacionId: e.comparacionId,
    storageKey: e.storageKey,
  })).sort((a: any, b: any) => a.id.localeCompare(b.id));
  const subject = (a: any) => a ? { id: a.id, razonSocial: a.razonSocial, cuit: a.cuit, domicilio: a.domicilio, telefono: a.telefono, email: a.email } : null;
  return JSON.parse(JSON.stringify({
    id: i.id, numero: i.numero, numeroActa: i.numeroActa, tipoActor: i.tipoActor,
    inspectorId: i.inspectorId, inspector: { id: i.inspector?.id, nombre: i.inspector?.nombre, apellido: i.inspector?.apellido },
    generadorId: i.generadorId, transportistaId: i.transportistaId, operadorId: i.operadorId,
    generador: subject(i.generador), transportista: subject(i.transportista), operador: subject(i.operador),
    ubicacion: i.ubicacion, latitud: i.latitud, longitud: i.longitud, iniciadaAt: i.iniciadaAt, createdAt: i.createdAt,
    observaciones: i.observaciones, datosActa: act,
    items: (i.items || []).map((r: any) => ({ id: r.id, codigo: r.codigo, etiqueta: r.etiqueta, categoria: r.categoria, orden: r.orden, obligatorio: r.obligatorio, resultado: r.resultado, observacion: r.observacion, evidencias: evidencias.filter((e: any) => e.itemId === r.id) })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    comparaciones: (i.comparaciones || []).map((r: any) => ({ id: r.id, codigo: r.codigo, etiqueta: r.etiqueta, categoria: r.categoria, origen: r.origen, orden: r.orden, valorDeclarado: r.valorDeclarado, valorObservado: r.valorObservado, resultado: r.resultado, observacion: r.observacion, evidencias: evidencias.filter((e: any) => e.comparacionId === r.id) })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    evidencias,
  }));
}
export const inspectionSignatureHash = (i: any) => hashCanonicalPayload(inspectionSignatureSnapshot(i));
export function inspectionCurrentSignatures(i: any) {
  const hash = inspectionSignatureHash(i);
  return (i.eventos || []).filter((e: any) => e.tipo === 'ACTA_FIRMADA' && e.metadata?.contenidoSha256 === hash)
    .map((e: any) => ({ id: e.id, ...e.metadata.firma, registradaAt: e.createdAt, contenidoSha256: hash }));
}
export function signatureFieldErrors(i: any): string[] {
  const a = i.datosActa || {};
  const errors: string[] = [];
  if (!i.numeroActa?.trim()) errors.push('Completá el número de acta.');
  if (!i.observaciones?.trim()) errors.push('Registrá lo observado antes de firmar.');
  if (!i.ubicacion?.trim() && !a.ubicacionCampo) errors.push('Indicá el lugar de la visita.');
  if (a.contactoActa && !z.string().email().safeParse(a.contactoActa).success) errors.push('Revisá el correo de contacto o dejalo vacío.');
  for (const [index, m] of (a.medidas || []).entries()) {
    if (!m.detalle?.trim() || !m.responsable?.trim()) errors.push(`Completá el requerimiento ${index + 1} y su responsable.`);
    if ((m.dias === undefined) !== (m.tipoDias === undefined)) errors.push(`Completá cantidad y tipo de días del requerimiento ${index + 1}.`);
    if (m.dias && !m.inicio?.trim()) errors.push(`Indicá desde qué hecho se cuenta el plazo del requerimiento ${index + 1}.`);
  }
  return errors;
}
