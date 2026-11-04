import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire, externalKeys, root } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const { hashCanonicalPayload } = backendRequire(root + '/backend/dist/services/inspectionDocumentIntegrity.service.js');
const checks: string[] = [];
try {
  const baseline = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/protected-schemas-before.json', 'utf8'));
  for (const [key, rows] of Object.entries(baseline)) {
    const [schema, table] = key.split('.'); assert.ok(['public', 'payment_identity_20261020'].includes(schema)); assert.match(table, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    const current = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${schema}"."${table}" t`);
    assert.deepEqual(current, rows, key);
  }
  checks.push('all protected shared/prior QA rows unchanged by complete table fingerprints');
  const migration = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/migration.json', 'utf8'));
  const legacy = (await db.$queryRawUnsafe('SELECT row_to_json(t) AS row FROM adendas_manifiesto t WHERE id=$1', migration.legacyId))[0].row;
  const { informeHallazgo, ...original } = legacy; assert.equal(informeHallazgo, null);
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'), migration.legacyHash);
  checks.push('historical addendum original columns/JSON unchanged and no finding fabricated');
  const intakes = await db.antecedenteFiscalizacion.findMany(); assert.ok(intakes.length > 0);
  for (const row of intakes) {
    assert.equal(hashCanonicalPayload(row.evidencia), row.huellaEvidencia, row.id);
    assert.equal(row.claveOrigen, `${row.origen}:${row.origenId}:${row.tipoActor}`);
    assert.equal(new Set(row.eventos.map((event: any) => event.id)).size, row.eventos.length);
    if (row.origen === 'INFORME_ADENDA') {
      const source = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: row.origenId } });
      assert.equal(hashCanonicalPayload(source.informeHallazgo), row.huellaEvidencia);
    }
    if (row.estado === 'VINCULADA') { assert.ok(row.inspeccionId); assert.ok(await db.inspeccion.findUnique({ where: { id: row.inspeccionId } })); }
    assert.equal(JSON.stringify(row.evidencia).includes('accesoVersion'), false);
    assert.equal(JSON.stringify(row.evidencia).includes('eyJ'), false);
  }
  assert.equal(intakes.length, new Set(intakes.map((row: any) => row.claveOrigen)).size);
  checks.push('canonical evidence hashes survive JSONB, source links verified, no repeated source-role, no lost decisions or GPS secrets');
  assert.equal(await db.emailQueue.count(), 0);
  const processes = JSON.parse(readFileSync(process.env.QA_ARTIFACTS + '/processes.json', 'utf8'));
  for (const proc of processes) {
    const environment = Object.fromEntries(readFileSync(`/proc/${proc.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(pair => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]));
    assert.equal(environment.DISABLE_EMAILS, 'true'); assert.equal(environment.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(environment.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
    for (const key of externalKeys) assert.equal(environment[key], '');
    assert.equal(new URL(environment.DATABASE_URL).searchParams.get('schema'), 'inspection_intake_20261020');
  }
  checks.push('actual QA processes private schema, CAP closed and provider keys empty; no email queued');
  writeFileSync(process.env.QA_ARTIFACTS + '/audit.json', JSON.stringify({ passed: checks.length, checks, intakeCount: intakes.length, protectedTables: Object.keys(baseline).length, production: false, capClosed: true, externalDelivery: false }, null, 2));
  console.log('Final audit: ' + checks.length + ' groups PASS.');
} finally { await db.$disconnect(); }
