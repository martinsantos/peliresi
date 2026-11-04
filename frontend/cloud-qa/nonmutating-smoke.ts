/** Measure only the effects of these unauthenticated requests, in synthetic QA. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-liveness-smoke-20261031';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'liveness-smoke-20261031');
assert.equal(process.env.GITHUB_SHA, 'af64384d8dd848898ffbed4e1c139d787271861e');
const processes = JSON.parse(readFileSync(path.join(out, 'processes.json'), 'utf8'));
assert.deepEqual(processes.map((item: { file: string }) => item.file).sort(), ['runtime.ts', 'server.ts']);
for (const { pid } of processes) {
  const env = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean)
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  assertCloudEnvironment(env); assert.equal(env.QA_ARTIFACTS, out);
  assert.equal(env.QA_COMPAT_BACKEND, 'liveness-smoke-20261031');
  assert.equal(env.TRAINING_DATABASE_URL, ''); assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
}
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const query = `SELECT n.nspname AS schema, c.relname AS name,
  (xpath('//row/digest/text()',query_to_xml(format($q$SELECT count(*)::text || ':' || md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS digest FROM %I.%I AS t$q$,n.nspname,c.relname),false,true,'')))[1]::text AS digest
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'
  AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' ORDER BY n.nspname,c.relname;`;
const snapshot = async () => {
  const rows = await db.$queryRawUnsafe<Array<{ schema: string; name: string; digest: string }>>(query);
  assert.equal(rows.length, 128);
  return { tables: rows.length, hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
};
const origin = 'http://127.0.0.1:4177';
async function get(route: string, method = 'GET') {
  const target = new URL(route, origin); assert.equal(target.origin, origin);
  const response = await fetch(target, { method, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, `${method} ${target.pathname}`);
  return response;
}

try {
  const before = await snapshot(), checked: string[] = [];
  for (const [route, prefix] of [['/', '/assets/'], ['/app/', '/app/assets/']] as const) {
    const html = await (await get(route)).text();
    assert.match(html, /SITREP/i);
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1]);
    const local = scripts.filter(src => new URL(src, origin).pathname.startsWith(prefix));
    assert.ok(local.length > 0, `Missing ${route} application entry`);
    for (const src of local) {
      const asset = new URL(src, origin); assert.equal(asset.origin, origin); assert.ok(asset.pathname.startsWith(prefix));
      const response = await get(asset.pathname); assert.ok((await response.arrayBuffer()).byteLength > 100);
      checked.push(asset.pathname);
    }
  }
  const manual = await (await get('/manual/directorio.html')).text();
  assert.ok(manual.includes('La sonda de vida no comprueba la base de datos'));
  const live = await get('/api/health/live'); assert.equal((await live.json()).status, 'alive');
  await get('/api/health/live', 'HEAD');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const after = await snapshot(); assert.deepEqual(after, before);
  const result = { synthetic: true, production: false, productCommit: process.env.GITHUB_SHA,
    requests: ['GET /', 'GET /app/', ...checked.map(item => `GET ${item}`), 'GET /manual/directorio.html', 'GET /api/health/live', 'HEAD /api/health/live'],
    applicationTablesCompared: before.tables, digestUnchanged: true, digest: before.hash,
    excludesDatabaseReadiness: true, excludesAuthentication: true, backgroundJobsSuppressedInQa: true };
  writeFileSync(path.join(out, 'nonmutating-smoke.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
