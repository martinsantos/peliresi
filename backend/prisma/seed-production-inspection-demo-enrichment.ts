/**
 * Enriches one closed synthetic inspection for training/UI review.
 * It never sends notifications and never changes actors or credentials.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { PrismaClient } from '@prisma/client';
import { ensureInspectionDeclaredComparisons } from '../src/services/inspectionDeclaredSnapshot.service';
import { persistInspectionEvidence } from '../src/services/inspectionEvidence.service';

const prisma = new PrismaClient();
const INSPECTION = 'I-2026-000006';
const CONFIRM = process.env.ALLOW_PRODUCTION_INSPECTION_DEMO;

async function pdfBuffer(): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1B5E3C').text('DESCARGO SINTÉTICO - CAPACITACIÓN');
  doc.moveDown().font('Helvetica').fontSize(10).fillColor('#10213A')
    .text('Documento completamente ficticio para validar la trazabilidad de respuestas y adjuntos del módulo de inspecciones SITREP.')
    .moveDown().text('No representa una presentación real, no fue enviado por correo y no modifica la situación regulatoria de ningún actor.');
  doc.end();
  return finished;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl.includes('/trazabilidad_rrpp') || CONFIRM !== 'YES_ENRICH_SYNTHETIC_INSPECTION') {
    throw new Error('ABORTADO: conexión o confirmación de enriquecimiento demo inválida.');
  }
  const inspection = await prisma.inspeccion.findUnique({
    where: { numero: INSPECTION },
    include: { comparaciones: true, eventos: true, evidencias: true },
  });
  if (!inspection || !inspection.numeroActa?.startsWith('DEMO-INS-') || !inspection.observaciones?.includes('[DEMO]')) {
    throw new Error('ABORTADO: el expediente objetivo no está inequívocamente marcado como sintético.');
  }

  const baseline = { emails: await prisma.emailQueue.count(), notifications: await prisma.notificacion.count() };
  await ensureInspectionDeclaredComparisons(prisma, inspection);
  const comparisons = await prisma.comparacionInspeccion.findMany({ where: { inspeccionId: inspection.id }, orderBy: { orden: 'asc' } });
  await prisma.$transaction(comparisons.map((row, index) => prisma.comparacionInspeccion.update({
    where: { id: row.id },
    data: index === 3 ? {
      resultado: 'DIFIERE', valorObservado: 'Verificado en campo: requiere actualización documental',
      observacion: '[DEMO] La constancia exhibida requiere conciliación con el registro SITREP.',
      verificadoPorId: inspection.inspectorId, verificadoAt: new Date(),
    } : {
      resultado: 'COINCIDE', valorObservado: row.valorDeclarado || 'Sin dato exhibido',
      observacion: index === 0 ? '[DEMO] Identidad corroborada durante la visita.' : null,
      verificadoPorId: inspection.inspectorId, verificadoAt: new Date(),
    },
  })));

  const photo = await fs.promises.readFile(path.resolve('assets/inspection-demo/almacenamiento-sintetico-demo.png'));
  const photoHash = crypto.createHash('sha256').update(photo).digest('hex');
  let photoEvidence = await prisma.evidenciaInspeccion.findFirst({ where: { inspeccionId: inspection.id, sha256: photoHash } });
  if (!photoEvidence) {
    const stored = await persistInspectionEvidence({ buffer: photo, originalname: 'almacenamiento-sintetico-demo.png' } as Express.Multer.File, inspection.id);
    photoEvidence = await prisma.evidenciaInspeccion.create({ data: {
      inspeccionId: inspection.id, tipo: 'FOTO', nombreOriginal: 'almacenamiento-sintetico-demo.png',
      storageKey: stored.storageKey, mimeDetectado: stored.mimeType, bytes: stored.bytes, sha256: stored.sha256,
      descripcion: '[DEMO] Área de almacenamiento transitorio; un rótulo presenta desgaste.', creadoPorId: inspection.inspectorId,
      comparacionId: comparisons[3]?.id || null,
    } });
  }

  let notification = await prisma.eventoInspeccion.findFirst({ where: { inspeccionId: inspection.id, tipo: 'NOTIFICACION_PREPARADA', detalle: { contains: '[DEMO]' } } });
  if (!notification) notification = await prisma.eventoInspeccion.create({ data: {
    inspeccionId: inspection.id, usuarioId: inspection.inspectorId, tipo: 'NOTIFICACION_PREPARADA',
    titulo: 'Notificación preparada', detalle: '[DEMO] Solicitud de actualización documental preparada para capacitación.',
    visibleActor: true, canal: 'EMAIL', estadoEntrega: 'NO_ENVIADO', destinatario: 'demo-no-enviar@example.invalid',
    metadata: { synthetic: true, dispatchDisabled: true },
  } });

  let responseEvent = await prisma.eventoInspeccion.findFirst({ where: { inspeccionId: inspection.id, tipo: 'RESPUESTA_ACTOR', detalle: { contains: '[DEMO]' } } });
  if (!responseEvent) responseEvent = await prisma.eventoInspeccion.create({ data: {
    inspeccionId: inspection.id, usuarioId: inspection.inspectorId, tipo: 'RESPUESTA_ACTOR',
    titulo: 'Respuesta del actor', detalle: '[DEMO] El interesado presenta descargo y constancia actualizada.',
    visibleActor: true, canal: 'PORTAL_ACTOR', metadata: { synthetic: true },
  } });

  const existingDocuments = await prisma.evidenciaInspeccion.findMany({
    where: {
      inspeccionId: inspection.id,
      eventoId: responseEvent.id,
      nombreOriginal: 'descargo-habilitacion-demo.pdf',
    },
    orderBy: { createdAt: 'asc' },
  });
  let documentEvidence = existingDocuments[0];
  if (existingDocuments.length > 1) {
    await prisma.evidenciaInspeccion.deleteMany({
      where: { id: { in: existingDocuments.slice(1).map((item) => item.id) } },
    });
  }
  if (!documentEvidence) {
    const document = await pdfBuffer();
    const stored = await persistInspectionEvidence({ buffer: document, originalname: 'descargo-habilitacion-demo.pdf' } as Express.Multer.File, inspection.id);
    documentEvidence = await prisma.evidenciaInspeccion.create({ data: {
      inspeccionId: inspection.id, tipo: 'DOCUMENTO', nombreOriginal: 'descargo-habilitacion-demo.pdf',
      storageKey: stored.storageKey, mimeDetectado: stored.mimeType, bytes: stored.bytes, sha256: stored.sha256,
      descripcion: '[DEMO] Descargo sintético para capacitación.', creadoPorId: inspection.inspectorId, eventoId: responseEvent.id,
    } });
  }
  await prisma.inspeccion.update({ where: { id: inspection.id }, data: { version: { increment: 1 } } });
  const after = { emails: await prisma.emailQueue.count(), notifications: await prisma.notificacion.count() };
  if (JSON.stringify(baseline) !== JSON.stringify(after)) throw new Error('SALVAGUARDA: cambiaron contadores de comunicaciones.');
  console.log(JSON.stringify({
    inspection: INSPECTION,
    comparisons: comparisons.length,
    photoEvidence: photoEvidence.id,
    documentEvidence: documentEvidence.id,
    syntheticDuplicatesRemoved: Math.max(0, existingDocuments.length - 1),
    notificationStatus: notification.estadoEntrega,
    responseEvent: responseEvent.id,
    communicationsUnchanged: true,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
