/**
 * Live preview only: give the synthetic accounts memorable sign-ins for hands-on review.
 * Runs against the isolated preview DB (asserted), never on fixtures used by automated suites:
 * call it only after `database` restores the live preview, never before `http`/`e2e`.
 */
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const bcrypt = backendRequire('bcryptjs');
const db = new PrismaClient();
// Memorable on purpose and only valid inside the air-gapped preview: role@sitrep.test / Sitrep2026
const password = 'Sitrep2026';
const roles = ['admin', 'generador', 'transportista', 'operador', 'inspector'];
try {
  const hash = await bcrypt.hash(password, 10);
  for (const role of roles) {
    const updated = await db.usuario.updateMany({ where: { email: role + '@night-qa.invalid' }, data: { email: role + '@sitrep.test', password: hash } });
    console.log(role + '@sitrep.test', updated.count === 1 ? 'listo' : 'no encontrado');
  }
} finally {
  await db.$disconnect();
}
