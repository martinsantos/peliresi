import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLoadRuntime } from './night-load-safety.ts';

const cloudURL = 'postgresql://qa@127.0.0.1:55440/sitrep_night_qa_20260926?schema=public&connection_limit=3';
const oldURL = 'postgresql://santosma@127.0.0.1:55440/sitrep_night_qa_20260926?schema=public';
const runtime = (url = cloudURL, changes: Record<string, string> = {}) =>
  'node /repo/frontend/cloud-qa/runtime.ts ' + Object.entries({
    DATABASE_URL: url, NODE_ENV: 'test', ALLOW_SYNTHETIC_QA: '1',
    DISABLE_EMAILS: 'true', BLOCKCHAIN_ENABLED: 'false', ENABLE_ANALYTICS: 'false',
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
    BLOCKCHAIN_RPC_URL: '', BLOCKCHAIN_CONTRACT_ADDRESS: '', ...changes,
  }).map(([key, value]) => `${key}=${value}`).join(' ') + ' ';

test('accepts the original isolated runtime', () => assert.doesNotThrow(() => assertLoadRuntime(runtime(oldURL), oldURL)));
test('accepts the cloud QA user and its exact pool query, not a hardcoded local username', () =>
  assert.doesNotThrow(() => assertLoadRuntime(runtime(), cloudURL)));
test('a listener serving another database URL cannot pass, even if both databases are synthetic', () =>
  assert.throws(() => assertLoadRuntime(runtime(oldURL), cloudURL)));
test('foreign hosts, ports and production database names are rejected', () => {
  for (const url of ['postgresql://qa@23.105.176.45:55440/sitrep_night_qa_20260926',
    'postgresql://qa@127.0.0.1:5432/sitrep_night_qa_20260926',
    'postgresql://qa@127.0.0.1:55440/trazabilidad_rrpp']) {
    assert.throws(() => assertLoadRuntime(runtime(url), url));
  }
});
test('every delivery channel and analytics must be disabled in the actual listener', () => {
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY',
    'BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_CONTRACT_ADDRESS']) {
    assert.throws(() => assertLoadRuntime(runtime(cloudURL, { [key]: 'enabled' }), cloudURL));
  }
  for (const [key, value] of Object.entries({ NODE_ENV: 'production', ALLOW_SYNTHETIC_QA: '0',
    DISABLE_EMAILS: 'false', BLOCKCHAIN_ENABLED: 'true', ENABLE_ANALYTICS: 'true' })) {
    assert.throws(() => assertLoadRuntime(runtime(cloudURL, { [key]: value }), cloudURL));
  }
});
