import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-incident-retry-final-20261101';
const commit = '17e74c8d85dc1cc3854886e3d70f6d62abb0898d';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.GITHUB_SHA, commit);
const stage = process.env.QA_SOURCE_STAGE; assert.ok(stage === 'before' || stage === 'after');
const files: Array<{ path: string; sha256: string }> = [];
function walk(relative: string) {
  for (const entry of readdirSync(path.join(out, relative), { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(child);
    else if (entry.isFile()) files.push({ path: child, sha256: createHash('sha256').update(readFileSync(path.join(out, child))).digest('hex') });
    else throw new Error('Unexpected asset type: ' + child);
  }
}
for (const directory of ['dist-backend', 'web-final', 'app-final']) walk(directory);
files.sort((a, b) => a.path.localeCompare(b.path)); assert.ok(files.length > 400);
const reference = path.join(out, 'assets-manifest.json');
if (stage === 'before') writeFileSync(reference, JSON.stringify({ commit, files }), { flag: 'wx', mode: 0o600 });
const prior = JSON.parse(readFileSync(reference, 'utf8')); assert.equal(prior.commit, commit);
const different = JSON.stringify(prior.files) === JSON.stringify(files) ? [] : ['compiled artifacts changed'];
writeFileSync(path.join(out, `assets-${stage}.json`), JSON.stringify({ commit, files: files.length, different }, null, 2), { flag: 'wx', mode: 0o600 });
assert.deepEqual(different, []);
console.log(`Cotejados ${files.length} archivos compilados (${stage}).`);
