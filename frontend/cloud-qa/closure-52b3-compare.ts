import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026103090';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'closure-52b3bec4');
assert.equal(process.env.GITHUB_SHA, '52b3bec4c72eefa9d88c221b6bb36b56c2fcafdf');
const fresh = '/work/sitrep/backend/dist-qa-closure-52b3bec4';
const previous = '/work/sitrep/backend/dist-qa-psip-deadline-company-20261030-v6';
function files(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(dir, path.join(prefix, entry.name)) : entry.name.endsWith('.js') ? [path.join(prefix, entry.name)] : []);
}
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const a = files(fresh).sort(), b = files(previous).sort(), aSet = new Set(a), bSet = new Set(b);
const missing = a.filter(file => !bSet.has(file)), extra = b.filter(file => !aSet.has(file));
const changed = a.filter(file => bSet.has(file) && hash(path.join(fresh, file)) !== hash(path.join(previous, file)));
assert.equal(a.length, 210); assert.deepEqual(missing, []); assert.deepEqual(extra, []); assert.deepEqual(changed, []);
assert.ok(a.every(file => !file.includes('gpsReceptionObservations')));
const result = { commit: process.env.GITHUB_SHA, freshFiles: a.length, previousFiles: b.length, missing, extra, changed,
  uncommittedGpsIncluded: false, production: false };
writeFileSync(path.join(out, 'backend-compiled-comparison.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Coinciden ${a.length} archivos JavaScript de backend.`);
