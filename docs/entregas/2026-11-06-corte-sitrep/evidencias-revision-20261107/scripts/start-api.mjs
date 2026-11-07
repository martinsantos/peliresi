// Start the review API (3052) with exactly the isolated environment of the cut's preview API (3051).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const LAB = '/qa/alta-ocr-correcciones-20261106';
const OUT = '/qa/revision-20261107';
const basePid = fs.readFileSync(LAB + '/relink-api.pid', 'utf8').trim();
const env = Object.fromEntries(fs.readFileSync('/proc/' + basePid + '/environ', 'utf8').split('\0').filter(Boolean)
  .map(kv => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
assert.equal(env.PORT, '3051');
for (const [k, v] of Object.entries({ DISABLE_EMAILS: 'true', PUSH_MANIFEST_NOTICES_ENABLED: 'false', INSPECTION_ACT_MAIL_ENABLED: 'false', SITREP_PAUSE_BACKGROUND_JOBS: 'true', SITREP_SYNTHETIC_PREVIEW: 'true' })) assert.equal(env[k], v, k);
for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'TRAINING_DATABASE_URL']) assert.ok(!env[k], k);
env.PORT = '3052';
const old = fs.existsSync(OUT + '/api.pid') ? Number(fs.readFileSync(OUT + '/api.pid', 'utf8')) : 0;
if (old && fs.existsSync('/proc/' + old) && fs.readlinkSync('/proc/' + old + '/cwd') === OUT + '/backend') { process.kill(old, 'SIGTERM'); for (let i = 0; i < 50 && fs.existsSync('/proc/' + old); i++) await sleep(100); }
const fd = fs.openSync(OUT + '/api.log', 'a');
const child = spawn(process.execPath, ['--max-old-space-size=300', 'dist/index.js'], { cwd: OUT + '/backend', env, detached: true, stdio: ['ignore', fd, fd] });
child.unref();
for (let i = 0; i < 60; i++) {
  await sleep(250);
  if (child.exitCode !== null) throw new Error('API de revisión no inició');
  try { const r = await fetch('http://127.0.0.1:3052/api/health'); if (r.ok) { fs.writeFileSync(OUT + '/api.pid', String(child.pid)); console.log('API revisión 3052 lista', child.pid); process.exit(0); } } catch {}
}
throw new Error('timeout');
