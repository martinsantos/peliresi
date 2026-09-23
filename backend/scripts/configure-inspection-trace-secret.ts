/** Configure the inspection trace signing key on a staged backend only. */
export {};
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const envPath = process.argv[2];
if (!envPath || path.basename(envPath) !== '.env' || !envPath.includes('candidate-')) {
  throw new Error('Pass the .env path of an isolated candidate backend.');
}

const existing = fs.readFileSync(envPath, 'utf8');
if (/^INSPECTION_TRACE_SECRET=/m.test(existing)) {
  throw new Error('Inspection trace secret is already configured; no change made.');
}

const secret = crypto.randomBytes(32).toString('hex');
const next = `${existing.trimEnd()}\nINSPECTION_TRACE_SECRET=${secret}\n`;
const temporary = `${envPath}.pending-${process.pid}`;
fs.writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 });
fs.renameSync(temporary, envPath);
fs.chmodSync(envPath, 0o600);
console.log('Inspection trace secret configured on candidate; value not displayed.');
