import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import { assertNightDatabase, qaEmail, qaPassword, seedNightDatabase } from './seed-night';
import { assertLoadRuntime } from './night-load-safety';

assertNightDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/sitrep_night_qa_20260926');
const base = process.env.QA_API_URL || 'http://127.0.0.1:3037/api';
assert.equal(base, 'http://127.0.0.1:3037/api');
const output = process.env.QA_ARTIFACTS || '';
assert.ok(path.isAbsolute(output) && /sitrep-night-20260926\.[^/]+$/.test(output));
// Confirm the actual process serving the local port before creating any records.
const pids = [...new Set(execFileSync('lsof', ['-t', '-iTCP:3037', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split(/\s+/))];
assert.equal(pids.length, 1);
const runtime = execFileSync('ps', ['eww', '-p', pids[0], '-o', 'command='], { encoding: 'utf8' });
assertLoadRuntime(runtime, process.env.DATABASE_URL!);

const db = new PrismaClient();
const run = randomUUID();
const sessions: Record<string, string> = {};
const requests: Array<{ group: string; method: string; status: number; ms: number }> = [];
const checks: Array<{ name: string; status: string; error?: string }> = [];
const manifestIds: string[] = [];
const startedAt = new Date().toISOString();

async function request(group: string, user: string | null, endpoint: string, method = 'GET', body?: unknown, expected = 200) {
  const start = performance.now();
  const response = await fetch(base + endpoint, {
    method, signal: AbortSignal.timeout(30_000), headers: {
      ...(user ? { Authorization: `Bearer ${sessions[user]}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  requests.push({ group, method, status: response.status, ms: performance.now() - start });
  assert.equal(response.status, expected, `${method} ${endpoint}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function check(name: string, task: () => Promise<void>) {
  try { await task(); checks.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, status: 'FAIL', error: message }); console.error(`FAIL ${name}: ${message}`);
  }
}

async function main() {
  const target = await db.$queryRaw<Array<{ name: string; port: number }>>`SELECT current_database() AS name, inet_server_port() AS port`;
  assert.deepEqual(target, [{ name: 'sitrep_night_qa_20260926', port: 55440 }]);
  assert.equal((await request('health', null, '/health')).db, 'connected');
  const fixture = await seedNightDatabase();
  for (const user of ['generador', 'transportista', 'transportista2', 'admin']) {
    const json = await request('login', null, '/auth/login', 'POST', { email: qaEmail(user), password: qaPassword });
    assert.equal(json.data.user.id, fixture.users[user]);
    sessions[user] = json.data.tokens.accessToken;
  }
  // Preparation bounded to ten concurrent creations. Measurement below launches 50 GPS writes together.
  const numbers: string[] = [];
  for (let batch = 0; batch < 5; batch++) {
    await Promise.all(Array.from({ length: 10 }, async () => {
      const created = await request('prepare/create', 'generador', '/manifiestos', 'POST', {
        operadorId: fixture.actors.operador, transportistaId: fixture.actors.transportista, modalidad: 'FIJO',
        observaciones: `QA LOAD 50 ${run}`, residuos: [{ tipoResiduoId: fixture.wastes[0], cantidad: 100, unidad: 'kg' }],
      }, 201);
      const record = created.data.manifiesto;
      manifestIds.push(record.id); numbers.push(record.numero);
      await request('prepare/approve', 'generador', `/manifiestos/${record.id}/firmar`, 'POST', {});
      await request('prepare/start', 'transportista', `/manifiestos/${record.id}/confirmar-retiro`, 'POST', { latitud: -32.88, longitud: -68.84 });
    }));
  }
  await check('50 distinct numbered trips are persisted EN_TRANSITO', async () => {
    assert.equal(new Set(numbers).size, 50);
    assert.equal(await db.manifiesto.count({ where: { id: { in: manifestIds }, estado: 'EN_TRANSITO' } }), 50);
  });
  const monitor = async (group: string, expectedState = 'EN_TRANSITO') => {
    const data = (await request(group, 'admin', '/centro-control/actividad?capas=transito')).data;
    const ours = data.enTransito.filter((row: { manifiestoId: string }) => manifestIds.includes(row.manifiestoId));
    assert.equal(ours.length, expectedState === 'EN_TRANSITO' ? 50 : 0);
    if (expectedState === 'EN_TRANSITO') assert.ok(ours.every((row: { ultimaPosicion?: unknown }) => row.ultimaPosicion));
  };
  const gpsRound = (group: string, round: number) => Promise.all(manifestIds.map((id, index) => request(
    group, 'transportista', `/manifiestos/${id}/ubicacion`, 'POST',
    { latitud: -32.88 + round * .0001, longitud: -68.84 + index * .00001, velocidad: 15, direccion: 180 },
  )));
  await check('50 simultaneous GPS writes (cold cache) while control center reads', async () => {
    await Promise.all([gpsRound('gps/cold', 1), monitor('monitor/cold')]);
  });
  await check('50 simultaneous GPS writes (warm cache) while control center reads', async () => {
    await Promise.all([gpsRound('gps/warm', 2), monitor('monitor/warm')]);
  });
  const countBeforeErrors = await db.trackingGPS.count({ where: { manifiestoId: { in: manifestIds } } });
  await check('50 invalid positions reject with 400; ten unrelated-carrier writes reject with 404', async () => {
    await Promise.all(manifestIds.map(id => request('gps/invalid', 'transportista', `/manifiestos/${id}/ubicacion`, 'POST', { latitud: 91, longitud: -68.84 }, 400)));
    await Promise.all(manifestIds.slice(0, 10).map(id => request('gps/wrong-owner', 'transportista2', `/manifiestos/${id}/ubicacion`, 'POST', { latitud: -32.88, longitud: -68.84 }, 404)));
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: { in: manifestIds } } }), countBeforeErrors);
  });
  console.log('Waiting 31 seconds to exercise expired GPS cache after rejected requests.');
  await new Promise(resolve => setTimeout(resolve, 31_000));
  await check('50 writes recover after rejected inputs and TTL expiry, without losing earlier positions', async () => {
    await Promise.all([gpsRound('gps/recovered-after-ttl', 3), monitor('monitor/recovered')]);
    const counts = await db.trackingGPS.groupBy({ by: ['manifiestoId'], where: { manifiestoId: { in: manifestIds } }, _count: { id: true } });
    assert.equal(counts.length, 50);
    assert.ok(counts.every(row => row._count.id === 4), JSON.stringify(counts));
    const rows = await Promise.all(manifestIds.map(id => request('gps/read-back', 'transportista', `/manifiestos/${id}/viaje-actual`)));
    assert.ok(rows.every(row => row.data.length === 4));
  });
  await check('50 concurrent deliveries persist one delivery event each', async () => {
    await Promise.all(manifestIds.map(id => request('deliver', 'transportista', `/manifiestos/${id}/confirmar-entrega`, 'POST', {})));
    assert.equal(await db.manifiesto.count({ where: { id: { in: manifestIds }, estado: 'ENTREGADO' } }), 50);
    const events = await db.eventoManifiesto.groupBy({ by: ['manifiestoId'], where: { manifiestoId: { in: manifestIds }, tipo: 'ENTREGA' }, _count: { id: true } });
    assert.equal(events.length, 50);
    assert.ok(events.every(row => row._count.id === 1));
  });
  await check('50 late GPS updates are rejected after delivery; no stale cache permits a write', async () => {
    await Promise.all(manifestIds.map(id => request('gps/after-delivery', 'transportista', `/manifiestos/${id}/ubicacion`, 'POST', { latitud: -32.88, longitud: -68.84 }, 404)));
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: { in: manifestIds } } }), 200);
    await monitor('monitor/delivered', 'ENTREGADO');
  });
  await check('backend and database remain healthy after the burst', async () => {
    assert.equal((await request('health', null, '/health')).db, 'connected');
  });
}

main().catch(error => {
  checks.push({ name: 'setup or unexpected error', status: 'FAIL', error: String(error) });
  console.error(String(error));
}).finally(async () => {
  const metrics = [...new Set(requests.map(row => row.group))].map(group => {
    const rows = requests.filter(row => row.group === group);
    const times = rows.map(row => row.ms).sort((a, b) => a - b);
    return { group, requests: rows.length, statuses: Object.fromEntries([...new Set(rows.map(row => row.status))].map(status => [status, rows.filter(row => row.status === status).length])),
      p50Ms: +times[Math.ceil(times.length * .5) - 1].toFixed(1), p95Ms: +times[Math.ceil(times.length * .95) - 1].toFixed(1), maxMs: +times.at(-1)!.toFixed(1) };
  });
  await writeFile(path.join(output, `load-50-${run}.json`), JSON.stringify({ run, startedAt, completedAt: new Date().toISOString(), target: base, database: 'sitrep_night_qa_20260926',
    limitations: ['One local API process, one synthetic carrier with 50 distinct trips, not 50 physical phones', 'No PM2 cluster, real mobile radio, battery, Safari, reverse proxy or production load equivalence'],
    manifestIds, checks, metrics }, null, 2));
  console.log(JSON.stringify({ checks, metrics }, null, 2));
  await db.$disconnect();
  if (checks.some(row => row.status === 'FAIL')) process.exitCode = 1;
});
