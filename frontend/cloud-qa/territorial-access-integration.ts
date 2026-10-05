import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

// Policy confirmed on 05/10: global operational consultation requires a real
// full-access session. It does not grant foreign dossier or mutation access.
await assertCloudDatabase();
const base = process.env.QA_API_URL;
assert.equal(base, 'http://127.0.0.1:3037/api');
const output = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(output, 'fixture.json'), 'utf8'));
assert.equal(fixture.database, 'sitrep_night_qa_20260926');
assert.equal(fixture.externalDelivery, false);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const results: { name: string; status: string; error?: string }[] = [];
let fatalError: string | undefined;
const sessions: Record<string, string> = {};
const actors = ['generador', 'transportista', 'operador'];
const cutoff = new Date();
// The timeline API's fecha is the FIRST civil day, not the last one. Preserve
// the real 20-day-old observation inside the same complete 30-day period.
const historyStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(cutoff.getTime() - 29 * 86400000));
const routes = ['/centro-control/actividad', '/centro-control/monitor-live',
  '/centro-control/active-days', '/centro-control/forecast',
  '/centro-control/timeline?fecha=' + historyStart + '&dias=30&corte=' + encodeURIComponent(cutoff.toISOString())];
type IdRow = { id: string };
type Trip = { manifiestoId: string };
type Activity = { generadores: IdRow[]; transportistas: IdRow[]; operadores: IdRow[]; enTransito: Trip[] };
type Live = { actores: Pick<Activity, 'generadores' | 'transportistas' | 'operadores'>; enTransito: Trip[]; estadisticas: { total: number } };
type Timeline = { eventos: { id: string; manifiestoId: string }[] };
async function call<T>(token: string | null, route: string, expected = 200, method = 'GET', body?: unknown) {
  const response = await fetch(base + route, { method, headers: {
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, method + ' ' + route);
  const result = await response.json() as { success: boolean; data?: T };
  assert.equal(result.success, expected < 400);
  if (expected >= 400) assert.equal(result.data, undefined, 'Denied reads must not return business data');
  return result.data as T;
}
async function check(name: string, task: () => Promise<void>) {
  try { await task(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); }
}
try {
  for (const [index, user] of ['admin', ...actors.map(actor => actor + '2')].entries()) {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Forwarded-For': '127.10.2.' + (index + 1),
    }, body: JSON.stringify({ email: user + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(response.status, 200);
    const login = await response.json() as { data: { user: { id: string }; tokens: { accessToken: string } } };
    assert.equal(login.data.user.id, fixture.users[user]);
    sessions[user] = login.data.tokens.accessToken;
  }
  await check('all five operational APIs deny anonymous and invalid sessions', async () => {
    for (const route of routes) for (const token of [null, 'invalid-qa-token']) await call(token, route, 401);
  });
  const adminActivity = await call<Activity>(sessions.admin, routes[0]);
  const adminLive = await call<Live>(sessions.admin, routes[1]);
  const adminDays = await call<{ days: string[] }>(sessions.admin, routes[2]);
  const adminForecast = await call<{ pendienteRetiro: Trip[]; pendienteTratamiento: Trip[] }>(sessions.admin, routes[3]);
  const adminTimeline = await call<Timeline>(sessions.admin, routes[4]);
  assert.ok(adminTimeline.eventos.some(event => event.id === 'GPS:cloud-qa-monitor-20-days'), 'Synthetic month contains the persisted historical observation');
  const ids = (rows: Trip[]) => rows.map(row => row.manifiestoId).sort();
  for (const actor of actors) await check(actor + ': real actor session receives global operational data', async () => {
    const token = sessions[actor + '2'];
    const activity = await call<Activity>(token, routes[0]);
    const live = await call<Live>(token, routes[1]);
    for (const type of actors) {
      const key = (type === 'generador' ? 'generadores' : type === 'operador' ? 'operadores' : 'transportistas') as keyof Pick<Activity, 'generadores' | 'transportistas' | 'operadores'>;
      assert.ok(live.actores[key].some(row => row.id === fixture.actors[type]), 'Foreign ' + type + ' must be consultable');
      assert.deepEqual(activity[key].map(row => row.id).sort(), adminActivity[key].map(row => row.id).sort());
    }
    assert.ok(activity.enTransito.some(trip => trip.manifiestoId === fixture.deviceManifest.id));
    assert.ok(live.enTransito.some(trip => trip.manifiestoId === fixture.deviceManifest.id));
    assert.deepEqual(ids(activity.enTransito), ids(adminActivity.enTransito));
    assert.equal(live.estadisticas.total, adminLive.estadisticas.total);
    assert.deepEqual(await call(token, routes[2]), adminDays);
    const forecast = await call<typeof adminForecast>(token, routes[3]);
    assert.deepEqual(ids(forecast.pendienteRetiro), ids(adminForecast.pendienteRetiro));
    assert.deepEqual(ids(forecast.pendienteTratamiento), ids(adminForecast.pendienteTratamiento));
    const timeline = await call<Timeline>(token, routes[4]);
    assert.ok(timeline.eventos.some(event => event.id === 'GPS:cloud-qa-monitor-20-days'), 'Global playback includes a persisted foreign observation');
    assert.deepEqual(timeline.eventos.map(event => event.id).sort(), adminTimeline.eventos.map(event => event.id).sort());
  });
  await check('global consultation does not grant foreign fichas, manifest access or mutations', async () => {
    const beforeTrip = await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.deviceManifest.id } });
    const beforeEvents = await db.eventoManifiesto.count({ where: { manifiestoId: fixture.deviceManifest.id } });
    for (const actor of actors) {
      const token = sessions[actor + '2'];
      const table = actor === 'generador' ? 'generadores' : actor === 'operador' ? 'operadores' : 'transportistas';
      await call(token, '/actores/' + table + '/' + fixture.actors[actor], 403);
      await call(token, '/actores/' + table + '/' + fixture.actors[actor], 403, 'PUT', { razonSocial: 'QA forbidden change' });
      // Foreign manifests deliberately return 404 rather than revealing their
      // existence. Cancel also enforces its role gate before the actor scope.
      await call(token, '/manifiestos/' + fixture.deviceManifest.id, 404);
      await call(token, '/manifiestos/' + fixture.deviceManifest.id + '/cancelar', actor === 'generador' ? 404 : 403, 'POST', { motivo: 'QA forbidden cancellation' });
      const record = await db[actor].findUniqueOrThrow({ where: { id: fixture.actors[actor] } });
      assert.equal(record.razonSocial, actor === 'transportista' ? 'QA Transporte 1' : actor === 'generador' ? 'QA Generador 1' : 'QA Operador 1');
    }
    assert.deepEqual(await db.manifiesto.findUniqueOrThrow({ where: { id: fixture.deviceManifest.id } }), beforeTrip);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: fixture.deviceManifest.id } }), beforeEvents);
  });
} catch (error) {
  fatalError = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await db.$disconnect();
  await writeFile(path.join(output, 'territorial-access.json'), JSON.stringify({
    commit: process.env.GITHUB_SHA, results, passed: results.filter(row => row.status === 'PASS').length,
    failed: results.filter(row => row.status === 'FAIL').length + (fatalError ? 1 : 0), fatalError,
    database: fixture.database, port: 55440, compiledApi: true, realLogin: true,
    externalProvidersDisabled: true, policy: 'global authenticated operational reads; separate dossier and write boundaries',
  }, null, 2));
}
assert.equal(results.length, 5);
assert.ok(results.every(row => row.status === 'PASS'), JSON.stringify(results));
