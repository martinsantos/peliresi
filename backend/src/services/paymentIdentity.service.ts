import type { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { normalizePaymentIdentity, paymentKeys, paymentProposal } from '../domain/paymentIdentity';
import type { ReceiptAnalysis } from './documentAnalysis.service';

export interface PaymentTarget { origen: 'SOLICITUD' | 'ACTOR'; documentoId: string; ambito: string; cuit: string; sha256: string; historico?: boolean; aplicado?: boolean }
export const solicitudPaymentScope = (id: string) => 'SOLICITUD:' + id;
export const actorPaymentScope = (tipo: string, id: string, anio?: number | null) => `ACTOR:${tipo}:${id}:${anio ?? 'SIN_PERIODO'}`;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const duplicate = () => new AppError('Este pago ya está vinculado a otro trámite. Cambiar la foto, el archivo o el CUIT no habilita un nuevo uso. Revisá el original con administración.', 409);

/** OCR only proposes data. Only a scoped administrator can allocate a payment. */
export async function paymentAnalysis(tx: Prisma.TransactionClient, analysis: ReceiptAnalysis, ambito: string): Promise<ReceiptAnalysis> {
  const propuesta = paymentProposal(analysis.texto), keys = paymentKeys(propuesta.campos);
  const known = keys.length ? await tx.clavePagoComprobante.findFirst({ where: { clave: { in: keys }, registro: { ambito: { not: ambito } } }, select: { clave: true } }) : null;
  return { ...analysis, pago: { propuesta, revision: 'PENDIENTE', coincidencia: Boolean(known) } };
}

async function lockKeys(tx: Prisma.TransactionClient, keys: string[]) {
  for (const key of [...new Set(keys)].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}

/** Never silently trust an old approval made before this ledger existed.
 * Read only existing OCR metadata, at most 500 UNINDEXED approvals per source.
 * Above this bound or without an identity, require historical identification.
 * No external documents, unrestricted query result or other owner is returned. */
async function checkHistoricalPayments(tx: Prisma.TransactionClient, keys: string[], target: PaymentTarget) {
  const [applications, actors] = await Promise.all([
    tx.$queryRaw<Array<{ id: string; solicitudId: string; analisis: Prisma.JsonValue }>>`
      SELECT d.id, d."solicitudId", d.analisis FROM documentos_solicitud d
      WHERE d.tipo = 'COMPROBANTE_PAGO' AND d.estado = 'APROBADO' AND NOT EXISTS (
        SELECT 1 FROM registros_pago_comprobante r WHERE r.origen = 'SOLICITUD'
        AND r.ambito = 'SOLICITUD:' || d."solicitudId" AND (
          (r."documentoId" = d.id AND r.sha256 = d.sha256) OR
          (r.id = (d.analisis #>> '{pago,registroId}') AND EXISTS (
            SELECT 1 FROM eventos_pago_comprobante e WHERE e."registroId" = r.id
            AND e."documentoId" = d.id AND e.sha256 = d.sha256 AND e.accion = 'CONFIRMADO'))))
      ORDER BY d.id LIMIT 501`,
    tx.$queryRaw<Array<{ id: string; generadorId: string | null; operadorId: string | null; transportistaId: string | null; anio: number | null; analisis: Prisma.JsonValue }>>`
      SELECT d.id, d."generadorId", d."operadorId", d."transportistaId", d.anio, d.analisis FROM documentos d
      WHERE d.tipo = 'COMPROBANTE_PAGO' AND d.estado = 'APROBADO' AND NOT EXISTS (
        SELECT 1 FROM registros_pago_comprobante r WHERE r.origen = 'ACTOR'
        AND r.ambito = (CASE WHEN d."generadorId" IS NOT NULL THEN 'ACTOR:generador:' || d."generadorId"
          WHEN d."operadorId" IS NOT NULL THEN 'ACTOR:operador:' || d."operadorId"
          ELSE 'ACTOR:transportista:' || d."transportistaId" END) || ':' || COALESCE(d.anio::text, 'SIN_PERIODO')
        AND ((r."documentoId" = d.id AND r.sha256 = d.sha256) OR
          (r.id = (d.analisis #>> '{pago,registroId}') AND EXISTS (
            SELECT 1 FROM eventos_pago_comprobante e WHERE e."registroId" = r.id
            AND e."documentoId" = d.id AND e.sha256 = d.sha256 AND e.accion = 'CONFIRMADO'))))
      ORDER BY d.id LIMIT 501`,
  ]);
  if (applications.length > 500 || actors.length > 500) throw new AppError('El historial de comprobantes requiere identificación administrativa por lotes antes de admitir pagos nuevos.', 409);
  const rows = [...applications.map(row => ({ id: row.id, origen: 'SOLICITUD', ambito: solicitudPaymentScope(row.solicitudId), analisis: row.analisis })),
    ...actors.map(row => ({ id: row.id, origen: 'ACTOR', ambito: actorPaymentScope(row.generadorId ? 'generador' : row.operadorId ? 'operador' : 'transportista', row.generadorId || row.operadorId || row.transportistaId || '', row.anio), analisis: row.analisis }))];
  for (const row of rows) {
    if (row.origen === target.origen && row.id === target.documentoId || row.ambito === target.ambito) continue;
    const old = paymentKeys(paymentProposal(String(object(row.analisis).texto || '')).campos);
    if (!old.length && !target.historico) throw new AppError('Hay comprobantes aprobados anteriores sin identidad legible. Administración debe identificarlos antes de confirmar pagos nuevos.', 409);
    if (old.some(key => keys.includes(key))) throw duplicate();
  }
}

async function event(tx: Prisma.TransactionClient, registroId: string, target: PaymentTarget, accion: string, usuarioId: string, datos: Prisma.InputJsonObject) {
  const identity = { registroId, documentoId: target.documentoId, sha256: target.sha256, accion };
  await tx.eventoPagoComprobante.upsert({ where: { registroId_documentoId_sha256_accion: identity }, create: { ...identity, usuarioId, datos }, update: {} });
}

export async function confirmPayment(tx: Prisma.TransactionClient, target: PaymentTarget, input: unknown, usuarioId: string) {
  const identidad = normalizePaymentIdentity(input, target.cuit), keys = paymentKeys(identidad);
  await lockKeys(tx, [target.ambito, ...keys]);
  const matches = await tx.clavePagoComprobante.findMany({ where: { clave: { in: keys } }, include: { registro: true } });
  if (matches.some(match => match.registro.ambito !== target.ambito)) throw duplicate();
  if (new Set(matches.map(match => match.registroId)).size > 1) throw new AppError('Los identificadores pertenecen a registros distintos. Revisá el original; no se modificó ningún pago.', 409);
  await checkHistoricalPayments(tx, keys, target);
  let registro = matches[0]?.registro;
  if (registro) {
    const original = object(registro.identidad);
    for (const key of ['idComprobante', 'cuit', 'codigoTasa', 'fechaPago', 'importe', 'periodo', 'referenciaLiquidacion'] as const) {
      if (original[key] !== identidad[key]) throw new AppError('La identidad ya registrada es distinta. Se conserva el registro anterior; revisá los datos del original.', 409);
    }
    for (const key of ['transaccion', 'control'] as const) if (original[key] && identidad[key] && original[key] !== identidad[key]) throw new AppError('La operación no coincide con el pago registrado.', 409);
  } else {
    registro = await tx.registroPagoComprobante.create({ data: { ambito: target.ambito, origen: target.origen, documentoId: target.documentoId, sha256: target.sha256,
      cuit: identidad.cuit, identidad: { ...identidad }, confirmadoPor: usuarioId, estado: target.aplicado ? 'APLICADO' : 'CONFIRMADO' } });
  }
  const existing = new Set(matches.map(match => match.clave));
  for (const clave of keys.filter(key => !existing.has(key))) await tx.clavePagoComprobante.create({ data: { clave, registroId: registro.id } });
  await event(tx, registro.id, target, 'CONFIRMADO', usuarioId, { identidad: { ...identidad }, originalRevisado: true, acreditacionATM: false, identificacionHistorica: target.historico === true });
  return { registroId: registro.id, revision: 'CONFIRMADO' as const, coincidencia: false, identidad, sha256: target.sha256 };
}

export async function requirePaymentIdentity(tx: Prisma.TransactionClient, target: PaymentTarget, analysis: unknown) {
  const pago = object(object(analysis).pago);
  if (pago.revision !== 'CONFIRMADO' || pago.sha256 !== target.sha256 || typeof pago.registroId !== 'string') {
    throw new AppError('Falta identificar y reservar este pago contra el ticket original. No se aprobó el documento ni el alta.', 409);
  }
  const registro = await tx.registroPagoComprobante.findUnique({ where: { id: pago.registroId } });
  if (!registro || registro.ambito !== target.ambito || registro.cuit !== target.cuit.replace(/\D/g, '')) throw new AppError('El pago no está reservado para este trámite.', 409);
  const confirmed = await tx.eventoPagoComprobante.findUnique({ where: { registroId_documentoId_sha256_accion: { registroId: registro.id, documentoId: target.documentoId, sha256: target.sha256, accion: 'CONFIRMADO' } } });
  if (!confirmed) throw new AppError('El archivo actual necesita su propia revisión de identidad.', 409);
  return registro;
}

export async function applySolicitudPayments(tx: Prisma.TransactionClient, solicitudId: string, cuit: string, usuarioId: string) {
  const documents = await tx.documentoSolicitud.findMany({ where: { solicitudId, tipo: 'COMPROBANTE_PAGO' } });
  for (const doc of documents) {
    if (doc.estado !== 'APROBADO' || !doc.sha256) throw new AppError('Revisá e identificá el comprobante de pago antes de aprobar el alta.', 409);
    const target: PaymentTarget = { origen: 'SOLICITUD', documentoId: doc.id, ambito: solicitudPaymentScope(solicitudId), cuit, sha256: doc.sha256 };
    const record = await requirePaymentIdentity(tx, target, doc.analisis);
    await tx.registroPagoComprobante.update({ where: { id: record.id }, data: { estado: 'APLICADO' } });
    await event(tx, record.id, target, 'APLICADO', usuarioId, { solicitudId, acreditacionATM: false });
  }
}

export async function notePaymentDecision(tx: Prisma.TransactionClient, target: PaymentTarget, analysis: unknown, accion: 'APROBADO' | 'RECHAZADO' | 'REEMPLAZADO' | 'RETIRADO', usuarioId: string) {
  const data = object(object(analysis).pago);
  if (typeof data.registroId !== 'string') return;
  const registro = await tx.registroPagoComprobante.findUnique({ where: { id: data.registroId } });
  if (registro?.ambito === target.ambito) await event(tx, registro.id, target, accion, usuarioId, { reservaConservada: true });
}

export async function retainPaymentAllocation(tx: Prisma.TransactionClient, doc: { id: string; tipo: string; estado: string; sha256: string | null; analisis: unknown }, ambito: string, origen: PaymentTarget['origen'], accion: 'REEMPLAZADO' | 'RETIRADO', usuarioId: string) {
  if (doc.tipo !== 'COMPROBANTE_PAGO') return;
  const pago = object(object(doc.analisis).pago), identidad = object(pago.identidad);
  const target: PaymentTarget = { origen, documentoId: doc.id, ambito, sha256: doc.sha256 || '', cuit: typeof identidad.cuit === 'string' ? identidad.cuit : '' };
  if (doc.estado === 'APROBADO') await requirePaymentIdentity(tx, target, doc.analisis);
  await notePaymentDecision(tx, target, doc.analisis, accion, usuarioId);
}
