/** Rehearse the exact additive migration against a legacy shape, then roll back.
 * Cloud synthetic DB only; no mail runtime, no production connection or data.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const url = new URL(process.env.DATABASE_URL || '');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '55440');
assert.equal(url.pathname, '/sitrep_night_qa_20260926');
const require = createRequire(import.meta.url);
const db = require('../dist/lib/prisma.js').default;
const migration = readFileSync(new URL('../prisma/migrations/20261011190000_account_pending_mail/migration.sql', import.meta.url), 'utf8');
const clauses = migration.split(';').map(sql => sql.trim()).filter(Boolean);
assert.equal(clauses.length, 2);
const before = await db.usuario.count();
try {
  for (const invalid of [false, true]) {
    await assert.rejects(db.$transaction(async (tx: typeof db) => {
      const legacy = await tx.usuario.create({ data: { email: 'legacy-migration@qa.invalid', nombre: 'Synthetic legacy', password: 'not-a-login', rol: 'GENERADOR', activo: false } });
      // Only inside this rollback-only transaction: reproduce the prior schema.
      await tx.$executeRawUnsafe('ALTER TABLE "usuarios" DROP COLUMN "motivoInactividad"');
      for (const sql of clauses) await tx.$executeRawUnsafe(sql);
      const rows = await tx.$queryRawUnsafe('SELECT email, activo, "motivoInactividad" FROM "usuarios" WHERE id = $1', legacy.id);
      assert.equal(rows[0].email, 'legacy-migration@qa.invalid');
      assert.equal(rows[0].activo, false);
      assert.equal(rows[0].motivoInactividad, null, 'migration must not infer a historical account status');
      if (invalid) await tx.$executeRawUnsafe('UPDATE "usuarios" SET "motivoInactividad" = $1 WHERE id = $2', 'UNKNOWN', legacy.id);
      else {
        for (const value of ['PENDIENTE_APROBACION', 'SUSPENDIDA']) {
          await tx.usuario.update({ where: { id: legacy.id }, data: { motivoInactividad: value } });
        }
        throw new Error('QA_MIGRATION_ROLLBACK');
      }
    }), invalid ? /usuarios_motivo_inactividad_check/ : /QA_MIGRATION_ROLLBACK/);
  }
  assert.equal(await db.usuario.count(), before);
  assert.equal(await db.usuario.findUnique({ where: { email: 'legacy-migration@qa.invalid' } }), null);
  await db.usuario.findMany({ select: { motivoInactividad: true }, take: 1 });
  writeFileSync('/tmp/sitrep-mail-migration.json', JSON.stringify({ passed: true, exactMigration: '20261011190000_account_pending_mail', legacyStatusNotInferred: true, invalidStatusRejected: true, allProbeChangesRolledBack: true, deployment: false }, null, 2));
} finally { await db.$disconnect(); }
