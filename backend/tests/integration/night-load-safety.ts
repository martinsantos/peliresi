import assert from 'node:assert/strict';

/** Inspect the actual process on the QA listener, not just the test's env. */
export function assertLoadRuntime(runtime: string, databaseURL: string) {
  const database = new URL(databaseURL);
  assert.equal(database.hostname, '127.0.0.1');
  assert.equal(database.port, '55440');
  assert.equal(database.pathname, '/sitrep_night_qa_20260926');
  for (const flag of [
    `DATABASE_URL=${databaseURL}`,
    'NODE_ENV=test', 'DISABLE_EMAILS=true', 'BLOCKCHAIN_ENABLED=false',
    'ALLOW_SYNTHETIC_QA=1', 'ENABLE_ANALYTICS=false',
  ]) assert.ok(runtime.includes(flag + ' '), `QA listener missing ${flag.split('=')[0]}`);
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY', 'BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_CONTRACT_ADDRESS']) {
    assert.match(runtime, new RegExp(`(?:^|\\s)${key}=\\s`), `External channel must be disabled: ${key}`);
  }
}
