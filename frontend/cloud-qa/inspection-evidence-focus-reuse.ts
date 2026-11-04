import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-evidence-focus-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const file = path.join(out, 'fixture.json');
const fixture = JSON.parse(await readFile(file, 'utf8'));
assert.equal(fixture.synthetic, true);
assert.match(fixture.inspection.numero, /^QA-EVIDENCIA-/);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const account = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  assert.equal(account.activo, true); assert.equal(account.rol, 'ADMIN');
  fixture.users = { admin: account.id };
  await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
  console.log('Fixture artificial de QA preparado.');
} finally { await db.$disconnect(); }
