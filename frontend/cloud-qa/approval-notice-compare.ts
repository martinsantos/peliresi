import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-approval-notice-short-20261030';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'approval-notice-short');
const fresh = '/work/sitrep/backend/dist-qa-approval-notice-short-20261030';
const previous = '/work/sitrep/backend/dist-qa-closure-52b3bec4';
function files(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(dir, path.join(prefix, entry.name)) : entry.name.endsWith('.js') ? [path.join(prefix, entry.name)] : []);
}
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const a = files(fresh).sort(), b = files(previous).sort(), aSet = new Set(a), bSet = new Set(b);
const missing = a.filter(file => !bSet.has(file)), extra = b.filter(file => !aSet.has(file));
const changed = a.filter(file => bSet.has(file) && hash(path.join(fresh, file)) !== hash(path.join(previous, file)));
assert.equal(a.length, 210); assert.deepEqual(missing, []); assert.deepEqual(extra, []);
assert.deepEqual(changed, ['services/manifestProposal.service.js', 'services/notification-mail.service.js']);
assert.ok(a.every(file => !file.includes('gpsReceptionObservations')));
writeFileSync(path.join(out, 'backend-compiled-comparison.json'), JSON.stringify({ commit: process.env.GITHUB_SHA,
  freshFiles: a.length, previousFiles: b.length, missing, extra, changed, uncommittedGpsIncluded: false, production: false }, null, 2), { flag: 'wx', mode: 0o600 });
console.log('Los 210 archivos compilados sólo difieren en los dos servicios previstos.');
