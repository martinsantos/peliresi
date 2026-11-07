// Start the exception-branch API (3053) with the cut preview API's isolated env plus the new switch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const X = '/qa/excepcion-y-20261107';
const basePid = fs.readFileSync('/qa/alta-ocr-correcciones-20261106/relink-api.pid', 'utf8').trim();
const env = Object.fromEntries(fs.readFileSync('/proc/' + basePid + '/environ', 'utf8').split('\0').filter(Boolean).map(kv => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
for (const [k, v] of Object.entries({ PORT: '3051', DISABLE_EMAILS: 'true', PUSH_MANIFEST_NOTICES_ENABLED: 'false', INSPECTION_ACT_MAIL_ENABLED: 'false', SITREP_PAUSE_BACKGROUND_JOBS: 'true', SITREP_SYNTHETIC_PREVIEW: 'true' })) assert.equal(env[k], v, k);
for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'TRAINING_DATABASE_URL']) assert.ok(!env[k], k);
Object.assign(env, { PORT: '3053', GENERATOR_Y_EXCEPTIONS_ENABLED: 'true', MANIFEST_REVIEW_AUTHORITY_BY_ROLE: 'true', DATABASE_URL: env.DATABASE_URL + '&connection_limit=1' });
const old = fs.existsSync(X + '/api.pid') ? Number(fs.readFileSync(X + '/api.pid', 'utf8')) : 0;
if (old && fs.existsSync('/proc/' + old) && fs.readlinkSync('/proc/' + old + '/cwd') === X + '/backend') { process.kill(old, 'SIGTERM'); for (let i = 0; i < 50 && fs.existsSync('/proc/' + old); i++) await sleep(100); }
const fd = fs.openSync(X + '/api.log', 'a');
const child = spawn(process.execPath, ['--max-old-space-size=300', 'dist/index.js'], { cwd: X + '/backend', env, detached: true, stdio: ['ignore', fd, fd] });
child.unref();
for (let i = 0; i < 80; i++) {
  await sleep(250);
  if (child.exitCode !== null) throw new Error('API de excepciones no inició; ver ' + X + '/api.log');
  try { const r = await fetch('http://127.0.0.1:3053/api/health'); if (r.ok) { fs.writeFileSync(X + '/api.pid', String(child.pid)); console.log('API excepciones 3053 lista', child.pid); process.exit(0); } } catch {}
}
throw new Error('timeout');
