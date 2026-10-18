import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const base = process.env.QA_API_URL;
assert.equal(base, 'http://127.0.0.1:3037/api');
const output = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(output, 'fixture.json'), 'utf8'));
assert.equal(fixture.database, 'sitrep_night_qa_20260926');
assert.equal(fixture.externalDelivery, false);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const checks: string[] = [];
const evidence: Record<string, unknown> = {};
let failure: string | undefined;
try {
  const inactive = ['BORRADOR', 'CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'];
  for (const state of ['BORRADOR', 'PLANIFICADA', 'EN_CAMPO', 'EN_REVISION', 'NOTIFICADA', 'CERRADA_CONFORME', 'CANCELADA']) {
    await db.inspeccion.create({ data: {
      id: `cloud-qa-coherence-${state}`, numero: `QA-COHERENCE-${state}`, numeroActa: 'DEMO-COHERENCE',
      inspectorId: fixture.users.inspector, estado: state, tipoActor: 'GENERADOR', generadorId: fixture.actors.generador,
    } });
  }
  const tokens: Record<string, string> = {};
  for (const [index, user] of ['admin', 'inspector'].entries()) {
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Forwarded-For': `127.10.3.${index + 1}`,
    }, body: JSON.stringify({ email: user + '@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(login.status, 200);
    const session = await login.json() as { data: { user: { id: string }; tokens: { accessToken: string } } };
    assert.equal(session.data.user.id, fixture.users[user]);
    tokens[user] = session.data.tokens.accessToken;
  }
  const get = async (route: string, user = 'admin') => {
    const response = await fetch(base + route, { headers: { Authorization: 'Bearer ' + tokens[user] } });
    assert.equal(response.status, 200, route);
    const body = await response.json(); assert.equal(body.success, true); return body.data;
  };
  const expected = await db.inspeccion.count({ where: { estado: { notIn: inactive } } });
  const active = await get('/inspecciones/operaciones?limit=100');
  assert.equal(active.total, expected);
  assert.ok(active.items.every((row: { estado: string }) => !inactive.includes(row.estado)));
  assert.equal(Object.values(active.summary.byState).reduce((total: number, count) => total + Number(count), 0), expected);
  assert.equal(active.summary.sinUbicacion, await db.inspeccion.count({ where: { estado: { notIn: inactive }, OR: [{ latitud: null }, { longitud: null }] } }));
  checks.push('active list, grouped totals and missing-location summary exclude drafts and terminal states');
  const drafts = await get('/inspecciones/operaciones?activas=false&estado=BORRADOR&limit=100');
  assert.ok(drafts.items.some((row: { id: string }) => row.id === 'cloud-qa-coherence-BORRADOR'));
  checks.push('drafts remain available through an explicit all-states query');
  const exported = await get('/inspecciones/operaciones/exportar');
  assert.equal(exported.total, expected); assert.equal(exported.items.length, expected);
  assert.ok(exported.items.every((row: { estado: string }) => !inactive.includes(row.estado)));
  checks.push('operational export uses the same actual cohort, not a separate inflated total');
  const assigned = await get('/inspecciones/operaciones?limit=100', 'inspector');
  assert.equal(assigned.total, await db.inspeccion.count({ where: { inspectorId: fixture.users.inspector, estado: { notIn: inactive } } }));
  assert.ok(assigned.items.every((row: { inspectorId: string }) => row.inspectorId === fixture.users.inspector));
  checks.push('the changed active definition preserves inspector assignment scope');

  const now = new Date();
  const old = new Date(now.getTime() - 60 * 86400000);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const period = { gte: new Date(day + 'T00:00:00-03:00'), lte: new Date(day + 'T23:59:59.999-03:00') };
  for (const kind of ['created', 'started', 'gps', 'closed']) {
    const id = 'cloud-qa-coherence-trip-' + kind;
    await db.manifiesto.create({ data: {
      id, numero: 'QA-COHERENCE-TRIP-' + kind, generadorId: fixture.actors.generador,
      transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador,
      creadoPorId: fixture.users.admin, estado: kind === 'closed' ? 'TRATADO' : 'EN_TRANSITO',
      isDemoData: true, modalidad: 'FIJO', createdAt: kind === 'created' ? now : old,
      fechaRetiro: kind === 'started' ? now : old,
    } });
    if (kind === 'gps' || kind === 'closed') await db.trackingGPS.create({ data: { manifiestoId: id, latitud: -32.89, longitud: -68.84, timestamp: now } });
  }
  const trips = await db.manifiesto.findMany({ where: { estado: 'EN_TRANSITO', OR: [
    { createdAt: period }, { fechaRetiro: period }, { tracking: { some: { timestamp: period } } },
  ] }, select: { id: true } });
  const route = '/centro-control/actividad?fechaDesde=' + day + '&fechaHasta=' + day;
  const control = await get(route + '&capas=transito');
  assert.deepEqual(control.enTransito.map((row: { manifiestoId: string }) => row.manifiestoId).sort(), trips.map((row: { id: string }) => row.id).sort());
  assert.equal(control.estadisticas.enTransitoActivos, trips.length);
  assert.equal(control.estadisticas.porEstado.EN_TRANSITO, trips.length);
  assert.ok(['created', 'started', 'gps'].every(kind => control.enTransito.some((row: { manifiestoId: string }) => row.manifiestoId === 'cloud-qa-coherence-trip-' + kind)));
  assert.ok(!control.enTransito.some((row: { manifiestoId: string }) => row.manifiestoId === 'cloud-qa-coherence-trip-closed'));
  checks.push('map, agenda, KPI and transit pipeline agree for created, started and GPS-only trips');
  const hidden = await get(route + '&capas=');
  assert.deepEqual(hidden.enTransito, []);
  assert.equal(hidden.estadisticas.enTransitoActivos, trips.length);
  assert.equal(hidden.estadisticas.porEstado.EN_TRANSITO, trips.length);
  checks.push('hiding the transit layer does not change its operational KPI or permissions');
  evidence.inspections = { expected, actual: active.total, drafts: drafts.total, inspector: assigned.total };
  evidence.trips = { day, expected: trips.length, visible: control.enTransito.length, kpi: control.estadisticas.enTransitoActivos, hiddenKpi: hidden.estadisticas.enTransitoActivos };
} catch (error) {
  failure = error instanceof Error ? error.message : String(error); throw error;
} finally {
  await db.$disconnect();
  await writeFile(path.join(output, 'operational-coherence.json'), JSON.stringify({ commit: process.env.GITHUB_SHA,
    passed: checks.length, failed: failure ? 1 : 0, checks, failure, evidence,
    database: fixture.database, port: 55440, compiledApi: true, realLogin: true, externalProvidersDisabled: true,
  }, null, 2));
}
assert.equal(checks.length, 6);
