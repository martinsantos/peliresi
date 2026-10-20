import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
await assertCloudDatabase(); assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'payment_identity_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { confirmPayment } = backendRequire(path.join(root, 'backend/dist/services/paymentIdentity.service.js'));
const { paymentKeys } = backendRequire(path.join(root, 'backend/dist/domain/paymentIdentity.js'));
const marker = new Error('rollback all artificial volume cases'), key = randomUUID(), checks: string[] = [];
try {
  const base = await db.solicitudInscripcion.findFirstOrThrow({ include: { usuario: true } }), admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  const before = { docs: await db.documentoSolicitud.count(), ledger: await db.registroPagoComprobante.count(), aliases: await db.clavePagoComprobante.count(), events: await db.eventoPagoComprobante.count() };
  const identity = (id: string) => ({ emisor: 'ATM_TASAS', idComprobante: id, transaccion: id + '88', control: id + '77', cuit: base.usuario.cuit.replace(/\D/g, ''), codigoTasa: '162', fechaPago: '2026-10-20', importe: '1.00', periodo: 'Volumen artificial', referenciaLiquidacion: 'QA-VOLUME-' + id, originalRevisado: true });
  try {
    await db.$transaction(async (tx: any) => {
      const rows = Array.from({ length: 501 }, (_, index) => {
        const id = key + '-' + index, data = identity('991' + String(Date.now()) + index), sha256 = createHash('sha256').update(id).digest('hex');
        return { id, data, sha256, recordId: 'record-' + id };
      });
      await tx.documentoSolicitud.createMany({ data: rows.map(row => ({ id: row.id, solicitudId: base.id, tipo: 'COMPROBANTE_PAGO', nombre: 'ARTIFICIAL-VOLUMEN', path: '/synthetic/not-opened/' + row.id, mimeType: 'application/pdf', size: 1, sha256: row.sha256, estado: 'APROBADO', analisis: { pago: { revision: 'CONFIRMADO', registroId: row.recordId, sha256: row.sha256 } } })) });
      await tx.registroPagoComprobante.createMany({ data: rows.map(row => ({ id: row.recordId, ambito: 'SOLICITUD:' + base.id, origen: 'SOLICITUD', documentoId: row.id, sha256: row.sha256, cuit: row.data.cuit, identidad: row.data, estado: 'APLICADO', confirmadoPor: admin.id })) });
      await tx.clavePagoComprobante.createMany({ data: rows.flatMap(row => paymentKeys(row.data).map((clave: string) => ({ clave, registroId: row.recordId }))) });
      await tx.eventoPagoComprobante.createMany({ data: rows.map(row => ({ registroId: row.recordId, documentoId: row.id, sha256: row.sha256, accion: 'CONFIRMADO', usuarioId: admin.id, datos: { synthetic: true } })) });
      const target = { origen: 'SOLICITUD', documentoId: 'volume-new-' + key, ambito: 'SOLICITUD:volume-new-' + key, cuit: rows[0].data.cuit, sha256: 'a'.repeat(64) };
      await confirmPayment(tx, target, identity('998' + String(Date.now())), admin.id);
      checks.push('more than 500 correctly indexed approvals do not block a new payment; scoped SQL excludes them before the bound');
      await tx.documentoSolicitud.createMany({ data: rows.map(row => ({ id: 'legacy-' + row.id, solicitudId: base.id, tipo: 'COMPROBANTE_PAGO', nombre: 'ARTIFICIAL-LEGADO-NO-IDENTIFICADO', path: '/synthetic/not-opened/legacy-' + row.id, mimeType: 'application/pdf', size: 1, sha256: row.sha256, estado: 'APROBADO', analisis: { version: 1, texto: '' } })) });
      await assert.rejects(confirmPayment(tx, { ...target, documentoId: 'blocked-' + key, ambito: 'SOLICITUD:blocked-' + key }, identity('997' + String(Date.now())), admin.id), (error: any) => error.statusCode === 409 && error.message.includes('por lotes'));
      checks.push('501 unindexed historical approvals still stop a new allocation instead of silently ignoring the backlog');
      throw marker;
    }, { timeout: 30_000 });
    assert.fail('Volume fixture must never commit');
  } catch (error) { assert.equal(error, marker); }
  assert.deepEqual({ docs: await db.documentoSolicitud.count(), ledger: await db.registroPagoComprobante.count(), aliases: await db.clavePagoComprobante.count(), events: await db.eventoPagoComprobante.count() }, before);
  checks.push('all 1002 temporary documents and their ledger/alias/events rolled back, no reset or original changes');
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'payment-identity-volume.json'), JSON.stringify({ at: new Date().toISOString(), passed: checks.length, checks, committed: false, production: false }, null, 2));
  console.log('Payment history volume: ' + checks.length + ' groups PASS; complete rollback');
} catch (error) { console.error(JSON.stringify({ failed: true, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }
finally { await db.$disconnect(); }
