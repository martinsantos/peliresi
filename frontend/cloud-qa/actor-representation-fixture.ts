import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema')!;
assert.equal(schema, 'actor_representation_20261022');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.EMAIL_NOTIFICATION_FAMILIES, '');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!;
async function protectedTables() {
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
    writeFileSync(out + '/protected-before.json', JSON.stringify(await protectedTables()));
    await db.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  } else if (process.argv[2] === 'seed') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    assert.equal(await db.usuario.count(),0);
    const fixture=await loadSeed().seedNightDatabase();
    const password=await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!',8);
    for(const [key,rol] of [['admin-generador','ADMIN_GENERADOR'],['admin-operador','ADMIN_OPERADOR'],['admin-transporte','ADMIN_TRANSPORTISTA']]) {
      const user=await db.usuario.upsert({where:{email:key+'@night-qa.invalid'},update:{},create:{email:key+'@night-qa.invalid',nombre:'QA '+key,password,rol,activo:true,emailVerified:true,notifEmail:false}});
      fixture.users[key]=user.id;
    }
    writeFileSync(out+'/fixture.json',JSON.stringify({...fixture,synthetic:true,externalDelivery:false,capClosed:true,database:'sitrep_night_qa_20260926'}));
  } else if (process.argv[2] === 'rows') {
    await import('./actor-representation-http.ts');
  } else if (process.argv[2] === 'audit') {
    assert.deepEqual(await protectedTables(), JSON.parse(readFileSync(out + '/protected-before.json', 'utf8')));
    const processes = JSON.parse(readFileSync(out + '/processes.json', 'utf8'));
    for (const item of processes) {
      const env = Object.fromEntries(readFileSync(`/proc/${item.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
      for (const key of ['DISABLE_EMAILS', 'PUSH_MANIFEST_NOTICES_ENABLED', 'TRAINING_DATABASE_URL', 'TRAINING_DIRECT_LOGIN_UNTIL', 'EMAIL_NOTIFICATION_FAMILIES', 'EMAIL_EXTERNAL_ALERTS_ENABLED', 'EMAIL_EXTERNAL_ALERTS_ALLOWLIST', 'EMAIL_DELIVERY_NOT_BEFORE', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) assert.equal(env[key], process.env[key]);
    }
    assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    for (const alias of ['admin', 'generador', 'transporte', 'operador']) {
      const res = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.33.99' }, body: JSON.stringify({ email: alias + '@capacitacion.invalid', password: 'expired-qa-probe' }) });
      assert.equal(res.status, 403);
    }
    writeFileSync(out + '/audit.json', JSON.stringify({ protectedTables: Object.keys(await protectedTables()).length, emailAttempts: 0, activeMailQueue: 0, externalProvidersConfigured: false, capAliasesRejected: 4, processesVerified: processes.length }));
  } else throw new Error('Unknown fixture phase');
} finally { await db.$disconnect(); }
