import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const backendRequire = createRequire(new URL('../../backend/package.json', import.meta.url));
export const externalKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY', 'BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_CONTRACT_ADDRESS'];

/** Refuse production, other repositories, local machines and enabled delivery. */
export function assertCloudEnvironment(env = process.env) {
  assert.equal(env.CI, 'true');
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.GITHUB_REPOSITORY, 'martinsantos/peliresi');
  assert.equal(env.GITHUB_REF, 'refs/heads/codex/sitrep-cloud-qa-20261002');
  assert.equal(env.ALLOW_SYNTHETIC_QA, '1');
  const database = new URL(env.DATABASE_URL || '');
  assert.equal(database.hostname, '127.0.0.1');
  assert.equal(database.port, '55440');
  assert.equal(database.pathname, '/sitrep_night_qa_20260926');
  assert.equal(env.PORT, '3037');
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env.NODE_APP_INSTANCE, 'qa');
  assert.equal(env.DISABLE_EMAILS, 'true');
  assert.equal(env.BLOCKCHAIN_ENABLED, 'false');
  assert.equal(env.ENABLE_ANALYTICS, 'false');
  assert.equal(env.FRONTEND_URL, 'http://127.0.0.1:4177');
  assert.equal(env.CORS_ORIGIN, env.FRONTEND_URL);
  assert.equal(env.VITE_API_URL, '/api');
  for (const key of externalKeys) assert.equal(env[key], '', key);
}

export async function assertCloudDatabase() {
  assertCloudEnvironment();
  assert.equal(existsSync(path.join(root, 'backend/.env')), false, 'No production env files');
  const { PrismaClient } = backendRequire('@prisma/client');
  const db = new PrismaClient();
  try {
    const actual = await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address');
    assert.deepEqual(actual, [{name: 'sitrep_night_qa_20260926', port: 55440, address: '127.0.0.1'}]);
  } finally { await db.$disconnect(); }
}
