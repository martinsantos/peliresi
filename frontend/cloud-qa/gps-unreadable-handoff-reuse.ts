import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const previous = '/work/sitrep/.qa-operational-ui-current2026110103';
const out = '/work/sitrep/.qa-gps-handoff-20261101';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'gps-handoff-dd6e957d');
assert.equal(process.env.GITHUB_SHA, 'dd6e957df6b61a8934a812f74d6dafc7056b0534');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const bytes = readFileSync(path.join(previous, 'gps-unreadable-handoff-private.json'));
const fixture = JSON.parse(bytes.toString());
assert.deepEqual(Object.keys(fixture.cases).sort(), ['app', 'web-desktop']);
const baseline = JSON.parse(readFileSync(path.join(previous, 'gps-unreadable-handoff-baseline-80a.json'), 'utf8'));
assert.equal(baseline.stats.unexpected, 4); assert.equal(baseline.stats.expected, 0);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  for (const item of Object.values(fixture.cases) as Array<{ id: string; numero: string }>) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, estado: true, isDemoData: true } });
    assert.match(item.numero, /^QA-GPS-CORRUPT-HANDOFF-/);
    assert.deepEqual(trip, { numero: item.numero, estado: 'EN_TRANSITO', isDemoData: true });
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: item.id } }), 0);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: item.id } }), 0);
  }
  writeFileSync(path.join(out, 'gps-unreadable-handoff-private.json'), bytes, { flag: 'wx', mode: 0o600 });
  writeFileSync(path.join(out, 'baseline-provenance.json'), JSON.stringify({ source: previous,
    sourceProduct: '80a283bb7987a1906c8857eb5b147b2054d30b68', synthetic: true,
    copiedSha256: createHash('sha256').update(bytes).digest('hex'), casesUnchanged: 2 }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Dos viajes artificiales de la reproducción previa se conservaron sin entrega, relevo ni puntos GPS.');
} finally { await db.$disconnect(); }
