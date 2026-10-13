/** Bounded classroom burst, not a production load test or a device-capacity claim. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'training-fixture.json'), 'utf8'));
assert.equal(fixture.database, 'sitrep_night_qa_20260926');
assert.equal(fixture.externalDelivery, false);
assert.equal(fixture.users.length, 40);
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3037/api';
const timings: number[] = [];
async function request(route: string, token?: string, body?: unknown) {
  const start = performance.now();
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, route + ' status');
  const result = await response.json();
  return { data: result.data, durationMs: performance.now() - start };
}
try {
  // Match the deployed role ceiling, in the disposable VM only. The real
  // application remains responsible for its two-connection per-worker pool.
  await db.$executeRawUnsafe('ALTER ROLE sitrep_training_role CONNECTION LIMIT 4');
  const login = await request('/auth/login', undefined, { email: 'admin@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' });
  const administrator = login.data.tokens.accessToken;
  assert.ok(administrator);
  const sessions: Array<{ id: string; category: string; token: string }> = [];
  for (const user of fixture.users) {
    assert.match(user.id, /^cap-20261012-/);
    const entered = await request('/admin/training/impersonate/' + user.id, administrator, {});
    assert.equal(entered.data.user.id, user.id);
    assert.equal(entered.data.user.training, true);
    sessions.push({ id: user.id, category: user.category, token: entered.data.tokens.accessToken });
  }
  // 40 simultaneous authenticated requests per wave. No retry that could hide
  // an exhausted pool, identity crossover, or a failed request.
  for (let wave = 0; wave < 3; wave++) {
    await Promise.all(sessions.map(async user => {
      const result = await request(wave === 1 ? '/manifiestos?limit=100' : '/auth/profile', user.token);
      timings.push(result.durationMs);
      if (wave !== 1) {
        assert.equal(result.data.user.id, user.id);
        assert.equal(result.data.user.training, true);
      } else {
        const rows = result.data.manifiestos;
        assert.ok(Array.isArray(rows) && rows.length > 0, 'Actual manifests for ' + user.id);
        assert.ok(rows.every((r: { id: string }) => r.id.startsWith('cap-20261012-')));
        if (['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(user.category)) {
          const team = user.id.split('-').pop();
          assert.ok(rows.every((r: { id: string }) => r.id.startsWith(`cap-20261012-manifiesto-${team}-`)), 'No other team in actor manifest list');
        }
      }
    }));
  }
  const connections = await db.$queryRawUnsafe("SELECT count(*)::int AS total FROM pg_stat_activity WHERE usename = 'sitrep_training_role'");
  assert.ok(connections[0].total <= 4);
  assert.equal(await db.usuario.count({ where: { email: { endsWith: '@capacitacion.invalid' } } }), 0);
  const ordered = [...timings].sort((a, b) => a - b);
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'training-concurrency.json'), JSON.stringify({
    passed: true, accounts: 40, simultaneousRequests: 40, requests: timings.length,
    failures: 0, retries: 0, waves: 3, roleConnectionLimit: 4, connections: connections[0].total,
    p95Ms: Math.round(ordered[Math.ceil(ordered.length * .95) - 1]), maxMs: Math.round(ordered.at(-1)!),
    identitiesAndRealmPreserved: true, actorListsScoped: true, productionConnected: false,
    physicalDevicesTested: false, mailEnabled: false,
  }, null, 2), { flag: 'wx' });
  console.log('Classroom burst: 40 accounts, 120 requests, no failures or identity crossover');
} finally { await db.$disconnect(); }
