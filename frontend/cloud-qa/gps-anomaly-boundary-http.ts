import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-anomaly-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api', id = fixture.manifest.id;
async function login(email: string, client: number) {
  const response = await fetch(base + '/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.43.12.${client}` },
    body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200, `Login sintético: ${email}`);
  const data: any = await response.json();
  assert.notEqual(data.data.user.training, true);
  return data.data.tokens.accessToken as string;
}
async function get(token?: string) {
  return fetch(`${base}/anomalias/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id }, select: { numero: true, isDemoData: true } });
  assert.equal(manifest.numero, fixture.manifest.numero); assert.equal(manifest.isDemoData, true);
  assert.equal(await db.anomaliaTransporte.count({ where: { manifiestoId: id } }), 0);
  const tokens = {
    admin: await login('admin@night-qa.invalid', 1),
    generator: await login('generador@night-qa.invalid', 2),
    carrier: await login('transportista@night-qa.invalid', 3),
    operator: await login('operador@night-qa.invalid', 4),
    outsider: await login(fixture.outsiderEmail, 5),
  };
  assert.equal((await get()).status, 401);
  assert.equal((await get(tokens.outsider)).status, 404);
  const forbidden = await fetch(`${base}/anomalias/detectar/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.outsider}` } });
  assert.equal(forbidden.status, 403);
  const requests = await Promise.all(Array.from({ length: 8 }, () => fetch(`${base}/anomalias/detectar/${id}`, {
    method: 'POST', headers: { Authorization: `Bearer ${tokens.admin}` },
  })));
  assert.ok(requests.every(response => response.status === 200), 'Análisis concurrentes terminan correctamente');
  const anomalies = await db.anomaliaTransporte.findMany({ where: { manifiestoId: id } });
  assert.equal(anomalies.length, 1); assert.equal(anomalies[0].tipo, 'VELOCIDAD_ANORMAL');
  assert.match(anomalies[0].id, /^gpsan1_/);
  const repeated = await fetch(`${base}/anomalias/detectar/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.admin}` } });
  assert.equal(repeated.status, 200);
  assert.equal(await db.anomaliaTransporte.count({ where: { manifiestoId: id } }), 1);
  for (const token of [tokens.admin, tokens.generator, tokens.carrier, tokens.operator]) {
    const response = await get(token); assert.equal(response.status, 200);
    const body: any = await response.json(); assert.equal(body.data.length, 1); assert.equal(body.data[0].id, anomalies[0].id);
  }
  assert.equal((await get(tokens.outsider)).status, 404);
  let incidents: any[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    incidents = await db.eventoManifiesto.findMany({ where: { manifiestoId: id, tipo: 'INCIDENTE' } });
    if (incidents.length) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(incidents.length, 1); assert.equal(incidents[0].usuarioId, fixture.adminId);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  const proof = { synthetic: true, production: false, concurrentAnalyses: requests.length, anomalyRows: anomalies.length,
    incidentRows: incidents.length, administrativeAttribution: true, permittedRoles: ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR'],
    unrelatedActor: 404, unauthenticated: 401, emailsSent: 0, emailAttempts: 0, push: false, capClosed: true };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-anomaly-http-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
