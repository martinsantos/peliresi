/** Real PostgreSQL admission and analytics, exclusively on the synthetic preview. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-liveness-20261031');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const variant = process.env.QA_LIVENESS_VARIANT;
assert.ok(variant === 'baseline' || variant === 'candidate');
const built = path.join(root, variant === 'baseline' ? 'backend/dist-qa-followup-v2-20261031' : 'backend/dist-qa-liveness-20261031');
const express = backendRequire('express');
const { createApiAdmission, networkAdmissionIdentity } = backendRequire(path.join(built, 'middlewares/apiAdmission.js'));
const { PostgresAdmissionStore, admissionKey } = backendRequire(path.join(built, 'services/apiAdmission.service.js'));
const { analyticsMiddleware, flushAnalytics } = backendRequire(path.join(built, 'middlewares/analytics.middleware.js'));
const { default: jobPrisma } = backendRequire(path.join(built, 'lib/prisma.js'));
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const app = express(); app.set('trust proxy', 1);
app.use('/api/', createApiAdmission(new PostgresAdmissionStore(), { limit: 3 }));
app.use(analyticsMiddleware);
app.get('/api/health/live', (_req: unknown, res: any) => res.json({ status: 'alive' }));
app.get('/api/health', (_req: unknown, res: any) => res.json({ status: 'ok' }));
app.get('/api/health/ready', (_req: unknown, res: any) => res.json({ status: 'ready' }));
const server = createServer(app);
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const ip = variant === 'baseline' ? '198.18.130.11' : '198.18.130.12';
const marker = `QA-liveness-${variant}-${randomUUID()}`;
const key = admissionKey('api:anonymous', networkAdmissionIdentity({ ip }));
const request = async (route: string, method = 'GET') => {
  const response = await fetch(base + route, { method, headers: { 'X-Forwarded-For': ip, 'User-Agent': marker } });
  await response.text();
  return response.status;
};

try {
  assert.equal(await db.rateLimitCounter.count({ where: { key } }), 0);
  assert.deepEqual([await request('/api/health/live?probe=qa'), await request('/api/health/live/', 'HEAD'),
    await request('/API/HEALTH/LIVE')], [200, 200, 200]);
  assert.equal(await request('/api/health/live'), 429);
  await flushAnalytics();
  const livenessLogs = await db.analyticsLog.count({ where: { userAgent: marker, path: { startsWith: '/api/health/live', mode: 'insensitive' } } });
  assert.equal(livenessLogs, variant === 'baseline' ? 3 : 0);
  assert.equal(await db.rateLimitCounter.count({ where: { key } }), 0);
  assert.equal(await request('/api/health'), 200); assert.equal(await request('/api/health/ready'), 200);
  await flushAnalytics();
  const ordinaryLogs = await db.analyticsLog.count({ where: { userAgent: marker, path: { in: ['/api/health', '/api/health/ready'] } } });
  assert.equal(ordinaryLogs, 2);
  assert.equal((await db.rateLimitCounter.findUniqueOrThrow({ where: { key } })).hits, 2);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const result = { variant, synthetic: true, production: false, livenessStatuses: [200, 200, 200, 429],
    livenessAnalyticsRows: livenessLogs, livenessDbCounterRows: 0, otherHealthAnalyticsRows: ordinaryLogs,
    otherHealthDbHits: 2, emailAttempts: 0, emailsSent: 0, pushEnabled: false };
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, `integration-${variant}.json`), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await db.$disconnect(); await jobPrisma.$disconnect();
}
// The production middleware's empty periodic buffer has a referenced timer.
process.exit(0);
