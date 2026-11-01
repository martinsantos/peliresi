/** Exercise startup wiring against a compiled, isolated QA backend.
 * Cron registration and the email timer are intercepted: callbacks never run.
 * Execute each instance as a separate, sequential process.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const qaRoot = '/work/sitrep/.qa-scheduled-pause-20261101';
const require = createRequire(import.meta.url);
const db = new URL(process.env.DATABASE_URL || 'invalid:');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(db.hostname, '127.0.0.1');
assert.equal(db.port, '55440');
assert.equal(db.pathname, '/sitrep_night_qa_20260926');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.BLOCKCHAIN_ENABLED, 'false');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.VAPID_PUBLIC_KEY, '');
assert.equal(process.env.VAPID_PRIVATE_KEY, '');
assert.equal(process.env.ENABLE_ANALYTICS, 'false');
assert.ok(['paused-0', 'paused-1', 'normal-0', 'invalid-0'].includes(process.env.QA_CASE || ''));
const scenario = process.env.QA_CASE!;
assert.equal(process.env.NODE_APP_INSTANCE, scenario.endsWith('-1') ? '1' : '0');
assert.equal(process.env.SITREP_PAUSE_BACKGROUND_JOBS,
  scenario.startsWith('paused-') ? 'true' : scenario.startsWith('normal-') ? 'false' : 'invalid');
assert.ok(/^30(596|597|598|599)$/.test(process.env.PORT || ''));
const resultPath = `${qaRoot}/${scenario}.json`;

const cron = require('/work/sitrep/backend/node_modules/node-cron');
const registrations: string[] = [];
const interceptCron = (expression: string) => {
  registrations.push(expression);
  return { stop() {}, destroy() {} };
};
cron.schedule = interceptCron;
cron.default.schedule = interceptCron;
const email = require(`${qaRoot}/dist/services/email.service.js`);
let emailStarts = 0;
email.startEmailFlushTimer = () => { emailStarts++; };

async function run(): Promise<void> {
  if (scenario === 'invalid-0') {
    assert.throws(() => require(`${qaRoot}/dist/index.js`), /SITREP_PAUSE_BACKGROUND_JOBS/);
    assert.deepEqual(registrations, []);
    assert.equal(emailStarts, 0);
    writeFileSync(resultPath, JSON.stringify({ scenario, rejected: true, registrations, emailStarts }));
    return;
  }

  require(`${qaRoot}/dist/index.js`);
  let status = 0;
  for (let i = 0; i < 100 && !status; i++) {
    try { status = (await fetch(`http://127.0.0.1:${process.env.PORT}/api/health/live`)).status; }
    catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.equal(status, 200);
  if (scenario.startsWith('paused-')) {
    assert.deepEqual(registrations, []);
    assert.equal(emailStarts, 0);
  } else {
    assert.equal(registrations.length, 6);
    assert.equal(emailStarts, 1);
  }
  writeFileSync(resultPath, JSON.stringify({ scenario, status, registrations, emailStarts }));
}

run().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
