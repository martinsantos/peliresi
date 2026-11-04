/** Reuse the synthetic multi-activity receipt notice and render mail without sending. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-receipt-document-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, ''); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const attempt = process.env.QA_DOC_ATTEMPT;
assert.ok(attempt === 'before' || attempt === 'after');
const previous = JSON.parse(readFileSync('/work/sitrep/.qa-receipt-link-20261030/fixture.json', 'utf8'));
assert.equal(previous.synthetic, true); assert.equal(previous.production, false); assert.match(previous.owner, /@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const owner = await db.usuario.findUniqueOrThrow({ where: { email: previous.owner } });
  const application = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: previous.operator } });
  const generator = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: previous.generator } });
  assert.equal(application.usuarioId, owner.id); assert.equal(application.tipoActor, 'OPERADOR');
  assert.equal(generator.usuarioId, owner.id); assert.equal(generator.tipoActor, 'GENERADOR');
  const document = await db.documentoSolicitud.findUniqueOrThrow({ where: { id: previous.document } });
  assert.equal(document.solicitudId, application.id);
  const notice = await db.notificacion.findUniqueOrThrow({ where: { id: previous.notices[0] } });
  assert.equal(notice.usuarioId, owner.id);
  const data = JSON.parse(notice.datos); assert.equal(data.documentoId, document.id); assert.equal(data.solicitudId, application.id);
  const { notificationMailContent } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'services/notification-mail.service.js'));
  const common = { ...notice, email: owner.email, activo: true, emailVerified: true, notifEmail: true };
  const applicantMail = notificationMailContent({ ...common, rol: 'GENERADOR' });
  const adminMail = notificationMailContent({ ...common, rol: 'ADMIN_OPERADOR' });
  assert.ok(applicantMail?.html && adminMail?.html);
  writeFileSync(path.join(out, `fixture-${attempt}.json`), JSON.stringify({ synthetic: true, owner: previous.owner,
    generator: generator.id, operator: application.id, document: document.id, documentName: document.nombre,
    applicantMail: applicantMail.html, adminMail: adminMail.html }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Aviso y documento artificiales comprobados; correos renderizados en memoria.');
} finally { await db.$disconnect(); }
