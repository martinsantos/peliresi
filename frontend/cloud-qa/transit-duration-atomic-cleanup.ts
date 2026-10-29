import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const f = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'transit-atomic-private.json'), 'utf8'));
assert.match(f.run, /^[a-f0-9]{8}$/);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const rule = await db.reglaAlerta.findUniqueOrThrow({ where: { id: f.ruleId } });
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: f.manifestId } });
  assert.equal(rule.nombre, `QA duración atómica ${f.run}`);
  assert.equal(manifest.numero, `QA-ATOMIC-${f.run}`);
  const [r, m] = await db.$transaction([
    db.reglaAlerta.updateMany({ where: { id: rule.id, nombre: rule.nombre }, data: { activa: false } }),
    db.manifiesto.updateMany({ where: { id: manifest.id, numero: manifest.numero }, data: { isDemoData: true } }),
  ]);
  assert.equal(r.count, 1); assert.equal(m.count, 1);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'transit-atomic-cleanup.json'), JSON.stringify({
    ruleDisabled: true, manifestMarkedSynthetic: true, syntheticOnly: true,
  }));
  console.log('Regla de prueba desactivada y manifiesto artificial identificado.');
} finally { await db.$disconnect(); }
