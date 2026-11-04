/** Exercise real notice generation with artificial actors and a private database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-approval-notice-short-20261030';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'approval-notice-short');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const resultFile = path.join(out, 'approval-generation.json'); assert.equal(existsSync(resultFile), false);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { notifyManifestParties } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'services/manifestProposal.service.js'));
try {
  const users = await Promise.all(['generador', 'transportista', 'operador'].map(name => db.usuario.findUniqueOrThrow({
    where: { email: `${name}@night-qa.invalid` }, include: { generador: true, transportista: true, operador: true },
  })));
  for (const [index, name] of ['generador', 'transportista', 'operador'].entries()) {
    assert.equal(users[index].email, `${name}@night-qa.invalid`); assert.equal(users[index].activo, true);
    assert.match(users[index][name].razonSocial, /^QA /);
  }
  const participants = users.map(user => user.id), phases = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'];
  const results: unknown[] = [];
  for (const modalidad of ['FIJO', 'IN_SITU']) {
    const manifest = await db.manifiesto.create({ data: { numero: `QA-AVISO-${modalidad}-${randomUUID()}`,
      generadorId: users[0].generador.id, transportistaId: users[1].transportista.id, operadorId: users[2].operador.id,
      creadoPorId: users[0].id, estado: 'PENDIENTE_APROBACION', modalidad, isDemoData: true } });
    for (const [index, role] of phases.entries()) {
      const phase = `aprobacion-${role}`;
      const ids = await db.$transaction((tx: any) => notifyManifestParties(tx, manifest, phase, users[index].id, role));
      assert.ok(ids.length >= 3);
      const notices = await db.notificacion.findMany({ where: { id: { in: ids } }, include: { usuario: true } });
      assert.equal(notices.length, ids.length);
      for (const id of participants) assert.ok(notices.some((notice: any) => notice.usuarioId === id), `${modalidad} ${role}`);
      for (const notice of notices) {
        assert.match(notice.usuario.email, /@night-qa\.invalid$/);
        assert.match(notice.mensaje, /Revisá las aprobaciones\.$/);
        assert.doesNotMatch(notice.mensaje, /qué aprobaciones faltan/);
        const data = JSON.parse(notice.datos);
        assert.equal(data.fase, phase); assert.equal(data.partesRequeridas, 3); assert.equal(data.modalidad, modalidad);
      }
      const repeated = await db.$transaction((tx: any) => notifyManifestParties(tx, manifest, phase, users[index].id, role));
      assert.deepEqual(repeated, []);
      results.push({ modalidad, role, partiesNotified: 3, retryDidNotDuplicate: true });
    }
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(resultFile, JSON.stringify({ synthetic: true, production: false, results, emailAttempts: 0, emailSent: 0, push: false }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Generación verificada: ${results.length} combinaciones de rol y modalidad; sin envíos.`);
} finally { await db.$disconnect(); }
