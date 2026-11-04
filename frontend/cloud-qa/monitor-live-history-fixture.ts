import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const out = process.env.QA_ARTIFACTS!;
const history = JSON.parse(await readFile(path.join(out, 'monitor-history-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: history.manifestId },
    select: { id: true, numero: true, estado: true, isDemoData: true } });
  assert.equal(manifest.numero, history.numero); assert.equal(manifest.estado, 'EN_TRANSITO'); assert.equal(manifest.isDemoData, true);
  assert.equal(await db.trackingGPS.count({ where: { manifiestoId: manifest.id } }), 1);
  await writeFile(path.join(out, 'fixture.json'), JSON.stringify({ database: 'sitrep_night_qa_20260926',
    externalDelivery: false, deviceManifest: { id: manifest.id } }), { mode: 0o600 });
  console.log('Vista en vivo preparada para el mismo viaje artificial.');
} finally { await db.$disconnect(); }
