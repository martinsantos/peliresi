import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

// Calendar regression against the real compiled API and guarded PostgreSQL.
// Past synthetic observations do not change server clocks, response bodies or sessions.
await assertCloudDatabase();
const base = process.env.QA_API_URL;
assert.equal(base, 'http://127.0.0.1:3037/api');
const output = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(await readFile(path.join(output, 'fixture.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const checks: string[] = [];
const evidence: Record<string, unknown> = {};
let failure: string | undefined;
try {
  const columns = await db.$queryRawUnsafe(`SELECT table_name, column_name, data_type
    FROM information_schema.columns WHERE table_schema = 'public' AND
    ((table_name IN ('manifiestos', 'eventos_manifiesto') AND column_name = 'createdAt')
      OR (table_name = 'tracking_gps' AND column_name = 'timestamp'))`);
  assert.equal(columns.length, 3);
  assert.ok(columns.every((row: { data_type: string }) => row.data_type === 'timestamp without time zone'));
  const day = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
  const previous = new Date(new Date(day + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  const gpsUtcDay = new Date(Date.now() - 80 * 86400000).toISOString().slice(0, 10);
  const gpsCivilDay = new Date(new Date(gpsUtcDay + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  for (const [name, instant] of [['before', day + 'T02:59:59.999Z'], ['after', day + 'T03:00:00.000Z']]) {
    await db.manifiesto.create({ data: {
      id: 'cloud-qa-calendar-' + name, numero: 'QA-CALENDAR-' + name,
      generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista,
      operadorId: fixture.actors.operador, creadoPorId: fixture.users.admin,
      estado: 'TRATADO', isDemoData: true, modalidad: 'FIJO', createdAt: new Date(instant),
    } });
    await db.eventoManifiesto.create({ data: {
      id: 'cloud-qa-calendar-event-' + name, manifiestoId: 'cloud-qa-calendar-' + name,
      usuarioId: fixture.users.admin, tipo: 'CREACION', isDemoData: true, createdAt: new Date(instant),
      descripcion: 'QA frontera de calendario, observación completamente sintética',
    } });
  }
  await db.trackingGPS.create({ data: { id: 'cloud-qa-calendar-gps-only',
    manifiestoId: 'cloud-qa-calendar-before', latitud: -32.89, longitud: -68.84,
    timestamp: new Date(gpsUtcDay + 'T02:30:00Z'),
  } });
  // Keep the original failure's SQL result alongside the repaired real API result.
  // At the same UTC date, two persisted instants belong to different Mendoza days.
  const oldCalendar = await db.$queryRawUnsafe(`SELECT id, DATE("createdAt")::text AS fecha
    FROM eventos_manifiesto WHERE id IN ('cloud-qa-calendar-event-before', 'cloud-qa-calendar-event-after') ORDER BY id`);
  assert.deepEqual(oldCalendar.map((row: { fecha: string }) => row.fecha), [day, day]);
  evidence.originalUtcCalendar = oldCalendar;
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: {
    'Content-Type': 'application/json', 'X-Forwarded-For': '127.10.1.99',
  }, body: JSON.stringify({ email: 'admin@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(login.status, 200);
  const session = await login.json() as { data: { user: { id: string }; tokens: { accessToken: string } } };
  assert.equal(session.data.user.id, fixture.users.admin);
  const request = async (route: string) => {
    const response = await fetch(base + route, { headers: { Authorization: `Bearer ${session.data.tokens.accessToken}` } });
    assert.equal(response.status, 200, route);
    const body = await response.json() as { success: boolean; data: { days: string[]; eventos: Array<{ id: string }> } };
    assert.equal(body.success, true);
    return body.data;
  };
  const active = await request('/centro-control/active-days');
  assert.ok(active.days.includes(previous)); assert.ok(active.days.includes(day));
  assert.deepEqual(active.days, [...new Set(active.days)].sort());
  assert.ok(active.days.every(value => /^\d{4}-\d{2}-\d{2}$/.test(value)));
  evidence.activeDays = active.days;
  checks.push('UTC midnight does not move a persisted observation to the next Mendoza day');
  for (const [date, present, absent] of [[previous, 'before', 'after'], [day, 'after', 'before']]) {
    const timeline = await request('/centro-control/timeline?fecha=' + date);
    assert.ok(timeline.eventos.some(event => event.id === 'EVENTO:cloud-qa-calendar-event-' + present));
    assert.ok(!timeline.eventos.some(event => event.id === 'EVENTO:cloud-qa-calendar-event-' + absent));
  }
  checks.push('exclusive Mendoza midnight splits events exactly, without omissions or duplication');
  assert.ok(active.days.includes(gpsCivilDay));
  const gpsHistory = await request('/centro-control/timeline?fecha=' + gpsCivilDay);
  assert.ok(gpsHistory.eventos.some(event => event.id === 'GPS:cloud-qa-calendar-gps-only'));
  checks.push('a day with only persisted GPS is navigable and replays that actual observation');
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await db.$disconnect();
  await writeFile(path.join(output, 'monitor-calendar.json'), JSON.stringify({
    commit: process.env.GITHUB_SHA, passed: checks.length, failed: failure ? 1 : 0, checks, failure, evidence,
    database: 'sitrep_night_qa_20260926', port: 55440, compiledApi: true, realLogin: true,
    externalProvidersDisabled: true,
  }, null, 2));
}
