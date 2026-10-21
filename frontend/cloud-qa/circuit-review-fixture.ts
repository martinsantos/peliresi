import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire } from './safety.ts';

await assertCloudDatabase();
const schema = 'circuit_review_20261020';
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!;

export async function protectedTables() {
  const tables = await db.$queryRawUnsafe("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('information_schema',$1) AND table_schema NOT LIKE 'pg_%' ORDER BY 1,2", schema);
  const result: Record<string, unknown> = {};
  for (const row of tables) {
    assert.match(row.table_schema, /^[a-zA-Z_][a-zA-Z_0-9]*$/); assert.match(row.table_name, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    result[row.table_schema + '.' + row.table_name] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${row.table_schema}"."${row.table_name}" t`);
  }
  return result;
}
try {
  if (process.argv[2] === 'prepare') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1', schema), []);
    const before = await protectedTables();
    writeFileSync(out + '/protected-schemas-before.json', JSON.stringify(before, null, 2));
    await db.$executeRawUnsafe('CREATE SCHEMA circuit_review_20261020');
    console.log('New private schema allocated; prior QA tables fingerprinted: ' + Object.keys(before).length);
  } else if (process.argv[2] === 'seed') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    assert.equal(await db.usuario.count(), 0);
    await import('./manifest-fixture.ts');
    assert.deepEqual(await protectedTables(), JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8')));
    console.log('Canonical synthetic actors, fleet and immutable legacy baseline ready.');
  } else if (process.argv[2] === 'eventual-legacy') {
    // Compatibility fixture only; this does not replay migrations or reseed the database.
    const id = 'qa-legacy-exceptional';
    assert.equal(await db.registroManifiestoExcepcional.findUnique({ where: { id } }), null);
    const owner = await db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } });
    const datos = { id, generador: { nombre: 'QA legado', identificacion: 'QA-LEGACY', domicilio: '' },
      transportista: { nombre: '', identificacion: '', domicilio: '' }, patente: 'QA-OLD', motivo: 'QA contrato anterior',
      residuos: [{ corriente: 'Y1', cantidad: 5, unidad: 'kg' }] };
    await db.registroManifiestoExcepcional.create({ data: { id, operadorId: owner.operador.id, creadoPorId: owner.id,
      huellaSolicitud: 'qa-legacy-fingerprint', datos, etapa: 'RETIRADO', version: 1,
      eventos: [{ id: 'qa-legacy-event', version: 0, tipo: 'AVANCE', etapa: 'RETIRADO', nota: '', autorId: owner.id, fecha: '2026-10-15T12:00:00.000Z' }] } });
    console.log('One artificial pre-party-review record added; every prior row retained.');
  } else if (process.argv[2] === 'actor-reviewers') {
    const source = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
    for (const [name, rol] of [['admin-generador','ADMIN_GENERADOR'],['admin-operador','ADMIN_OPERADOR'],['admin-transporte','ADMIN_TRANSPORTISTA']]) {
      assert.equal(await db.usuario.findUnique({ where: { email: name + '@night-qa.invalid' } }), null);
      await db.usuario.create({ data: { email: name + '@night-qa.invalid', nombre: 'QA ' + name, password: source.password, rol, activo: true, emailVerified: true, notifEmail: false } });
    }
    console.log('Three additional isolated sector reviewers created without changing existing accounts.');
  } else if (process.argv[2] === 'operational-probes') {
    const fixture = JSON.parse(readFileSync(out + '/fixture.json', 'utf8'));
    assert.equal(fixture.externalDelivery, false); assert.equal(fixture.capClosed, true);
    assert.equal(fixture.followup, undefined); assert.equal(fixture.deviceManifest, undefined);
    const common = { generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista,
      operadorId: fixture.actors.operador, creadoPorId: fixture.users.admin, isDemoData: true, modalidad: 'FIJO' };
    const deviceManifest = await db.manifiesto.create({ data: { ...common, numero: 'QA-CIRCUIT-MONITOR-20261020', estado: 'EN_TRANSITO', fechaRetiro: new Date(),
      residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, unidad: 'kg', estado: 'SOLIDO' }] } } });
    await db.trackingGPS.create({ data: { manifiestoId: deviceManifest.id, latitud: -32.8895, longitud: -68.8458, velocidad: 0, timestamp: new Date() } });
    const followup = await db.manifiesto.create({ data: { ...common, numero: 'QA-CIRCUIT-FOLLOWUP-20261020', estado: 'RECIBIDO', fechaRecepcion: new Date(Date.now() - 3 * 86400000),
      residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, cantidadRecibida: 10, unidad: 'kg', estado: 'SOLIDO' }] } } });
    const followupDb = backendRequire('./dist/lib/prisma.js').default;
    try {
      const { ejecutarSeguimientoCierre } = backendRequire('./dist/jobs/seguimientoCierre.job.js');
      await ejecutarSeguimientoCierre(); await ejecutarSeguimientoCierre();
      const notices = await db.notificacion.findMany({ where: { manifiestoId: followup.id } });
      assert.equal(notices.length, 1); assert.equal(notices[0].usuarioId, fixture.users.operador);
    } finally { await followupDb.$disconnect(); }
    writeFileSync(out + '/fixture.json', JSON.stringify({ ...fixture, followup: { id: followup.id, numero: followup.numero }, deviceManifest: { id: deviceManifest.id, numero: deviceManifest.numero } }));
    console.log('Two additive operational probes and real idempotent follow-up ready; existing sources not reset.');
  } else if (process.argv[2] === 'attest-runtime') {
    const processes = JSON.parse(readFileSync(out + '/processes.json', 'utf8'));
    assert.deepEqual(processes.map((entry: { file: string }) => entry.file).sort(), ['runtime.ts', 'server.ts']);
    for (const process of processes) {
      const env = Object.fromEntries(readFileSync(`/proc/${process.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
      assertCloudEnvironment(env);
      assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'), schema);
      assert.equal(env.TRAINING_DATABASE_URL, '');
      assert.equal(env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
      assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
      assert.equal(env.EMAIL_NOTIFICATION_FAMILIES, '');
      assert.equal(env.EMAIL_EXTERNAL_ALERTS_ENABLED, 'false');
    }
    const raw = readFileSync(out + '/fixture.json', 'utf8'), fixture = JSON.parse(raw);
    assert.equal(fixture.database, 'sitrep_night_qa_20260926');
    assert.ok(fixture.externalDelivery === undefined || fixture.externalDelivery === false);
    writeFileSync(out + '/fixture-before-attestation.json', raw, { flag: 'wx' });
    writeFileSync(out + '/fixture.json', JSON.stringify({ ...fixture, externalDelivery: false, capClosed: true }));
    writeFileSync(out + '/fixture-runtime-attestation.json', JSON.stringify({ at: new Date().toISOString(), processesVerified: processes.length, schema, externalDelivery: false, capClosed: true, databaseMutations: 0 }));
    console.log('Actual runtime gates verified; only fixture metadata completed, no database mutation.');
  } else if (process.argv[2] === 'audit-protected') {
    const before = JSON.parse(readFileSync(out + '/protected-schemas-before.json', 'utf8'));
    assert.deepEqual(await protectedTables(), before);
    console.log('All prior QA table fingerprints unchanged: ' + Object.keys(before).length);
  } else throw new Error('Unknown fixture phase');
} finally { await db.$disconnect(); }
