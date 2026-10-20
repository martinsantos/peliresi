import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
await assertCloudDatabase(); assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'payment_identity_20261020');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const out = process.env.QA_ARTIFACTS!, file = path.join(out, 'payment-electricity-fixture.json');
const original = JSON.parse(readFileSync(file, 'utf8')), cases: Record<string, any> = {}, folder = path.join(process.env.UPLOADS_DIR!, 'fresh-browser-' + randomUUID());
mkdirSync(folder, { recursive: true });
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { jsPDF } = createRequire(path.join(root, 'frontend/package.json'))('jspdf');
const { readReceipt } = backendRequire(path.join(root, 'backend/dist/services/documentAnalysis.service.js'));
const { paymentAnalysis } = backendRequire(path.join(root, 'backend/dist/services/paymentIdentity.service.js'));
try {
  const stored = await db.registroPagoComprobante.findFirstOrThrow({ where: { ambito: 'SOLICITUD:' + original.cases.first.id } });
  const password = await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!', 8);
  let index = 0;
  for (const project of ['web-desktop', 'web-responsive', 'app']) {
    cases[project] = {};
    for (const kind of ['clean', 'conflict']) {
      const base = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: original.cases[project][kind].id }, include: { documentos: true } });
      const n = ++index, id = String(Date.now()) + n, cuit = `30-${String(Date.now() + n).slice(-8)}-2`;
      const user = await db.usuario.create({ data: { email: `qa-payment-browser-${randomUUID()}@night-qa.invalid`, nombre: 'QA revisión ' + project + ' ' + kind, cuit, password, rol: base.tipoActor, activo: false, motivoInactividad: 'PENDIENTE_APROBACION', emailVerified: true } });
      const data = { ...JSON.parse(base.datosActor), cuit, razonSocial: user.nombre };
      const solicitud = await db.solicitudInscripcion.create({ data: { usuarioId: user.id, tipoActor: base.tipoActor, estado: 'EN_REVISION', datosActor: JSON.stringify(data), fechaEnvio: new Date() } });
      for (const old of base.documentos.filter((doc: any) => doc.tipo !== 'COMPROBANTE_PAGO')) {
        const destination = path.join(folder, solicitud.id + '-' + old.id + '.pdf'); copyFileSync(old.path, destination, constants.COPYFILE_EXCL);
        await db.documentoSolicitud.create({ data: { solicitudId: solicitud.id, tipo: old.tipo, nombre: old.nombre, path: destination, mimeType: old.mimeType, size: old.size, sha256: old.sha256, estado: 'PENDIENTE' } });
      }
      const identity = { ...(kind === 'conflict' ? stored.identidad : original.cases[project].clean.identity), cuit,
        ...(kind === 'clean' ? { idComprobante: id, transaccion: '88' + id, control: '77' + id, referenciaLiquidacion: 'QA-LIQ-' + id } : {}), originalRevisado: true };
      const pdf = new jsPDF(); pdf.setFontSize(11); pdf.text(['ATM ADMINISTRACION TRIBUTARIA MENDOZA', 'ARTIFICIAL SIN VALIDEZ FISCAL', 'ID Comprobante: ' + identity.idComprobante, 'Transaccion: ' + identity.transaccion, 'Control: ' + identity.control, 'CUIT: ' + cuit, 'Codigo de Tasa: 162', 'Fecha Pago: 20/10/2026', 'IMPORTE TOTAL: $12.500,00'], 14, 20);
      const bytes = Buffer.from(pdf.output('arraybuffer')), destination = path.join(folder, solicitud.id + '-pago.pdf'); writeFileSync(destination, bytes);
      const reading = await readReceipt({ path: destination, mimeType: 'application/pdf' });
      const analysis = await db.$transaction((tx: any) => paymentAnalysis(tx, reading, 'SOLICITUD:' + solicitud.id));
      const doc = await db.documentoSolicitud.create({ data: { solicitudId: solicitud.id, tipo: 'COMPROBANTE_PAGO', nombre: 'Comprobante artificial ' + id + '.pdf', path: destination, mimeType: 'application/pdf', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), analisis: analysis } });
      cases[project][kind] = { id: solicitud.id, docId: doc.id, sha256: doc.sha256, identity };
    }
  }
  copyFileSync(file, path.join(out, 'payment-electricity-fixture-before-' + Date.now() + '.json'), constants.COPYFILE_EXCL);
  writeFileSync(file, JSON.stringify({ ...original, cases: { first: original.cases.first, ...cases }, fresh: true, oldCasesPreserved: true }, null, 2));
  console.log('Six fresh artificial review cases; original completed cases and their payments retained');
} finally { await db.$disconnect(); }
