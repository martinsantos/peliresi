/** Reuse a verified synthetic multirole account and the real notice producer. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-receipt-link-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const previous = JSON.parse(readFileSync('/work/sitrep/.qa-operational-ui-current2026103070/onboarding-ux-fixture.json', 'utf8'));
assert.match(previous.owner, /^onboarding-ux-[a-f0-9]+-\d+@night-qa\.invalid$/);
const own = previous.cases.filter((c: any) => c.email === previous.owner);
assert.deepEqual(own.map((c: any) => c.type).sort(), ['GENERADOR', 'OPERADOR', 'TRANSPORTISTA']);
const generator = own.find((c: any) => c.type === 'GENERADOR');
const operator = own.find((c: any) => c.type === 'OPERADOR');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { receiptNotice } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'services/documentAnalysis.service.js'));
try {
  const owner = await db.usuario.findUniqueOrThrow({ where: { email: previous.owner } });
  assert.equal(owner.activo, true); assert.equal(owner.emailVerified, true);
  for (const application of [generator, operator]) {
    const row = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: application.id } });
    assert.equal(row.usuarioId, owner.id); assert.equal(row.tipoActor, application.type); assert.equal(row.estado, 'APROBADA');
  }
  const document = await db.documentoSolicitud.findFirstOrThrow({ where: { solicitudId: operator.id, tipo: 'COMPROBANTE_PAGO' } });
  const notices: string[] = []; let lastNotice: any;
  for (let i = 0; i < 4; i++) {
    const created = await db.$transaction(async (tx: any) => {
      let saved: any;
      await receiptNotice({ notificacion: { create: async (args: any) => { saved = await tx.notificacion.create(args); return saved; } } },
        owner.id, { solicitudId: operator.id, documentoId: document.id });
      return saved;
    });
    assert.equal(created.usuarioId, owner.id);
    assert.deepEqual(JSON.parse(created.datos), { tipo: 'comprobante_repetido', solicitudId: operator.id,
      documentoId: document.id, ruta: '/mi-solicitud' });
    notices.push(created.id);
    lastNotice = created;
  }
  const { notificationMailContent } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'services/notification-mail.service.js'));
  const mail = notificationMailContent({ ...lastNotice, email: owner.email, activo: true, emailVerified: true,
    notifEmail: true, rol: 'GENERADOR' });
  assert.ok(mail?.html); assert.equal(mail.family, 'alertas');
  writeFileSync(path.join(out, 'fixture.json'), JSON.stringify({ synthetic: true, production: false, owner: previous.owner,
    generator: generator.id, operator: operator.id, document: document.id, notices, mailHtml: mail.html }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Cuenta artificial con tres actividades y cuatro avisos del productor real preparados.');
} finally { await db.$disconnect(); }
