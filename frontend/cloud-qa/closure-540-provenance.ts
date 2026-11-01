/** Verify the frozen product, its compiled assets and QA harness without touching production. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026110105';
const frozen = '/work/sitrep/.qa-gps-send-ambiguity-20261101';
const backend = '/work/sitrep/.qa-incident-retry-final-20261101';
const commit = '540ecfff63304bbba5268ccc24c9a3960bdf849c';
const stage = process.env.QA_SOURCE_STAGE;
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'closure-540ecfff');
assert.equal(process.env.GITHUB_SHA, commit);
assert.ok(stage === 'before' || stage === 'after');
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const blob = (bytes: Buffer) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const safe = (base: string, name: string) => {
  assert.doesNotMatch(name, /(?:^|\/)\.\.(?:\/|$)/);
  const file = path.resolve(base, name);
  assert.ok(file.startsWith(path.resolve(base) + path.sep));
  return file;
};
const source = read(path.join(frozen, 'source-manifest.json'));
assert.equal(source.commit, commit); assert.equal(source.files.length, 2684);
const missing: string[] = [], different: string[] = [];
for (const entry of source.files) {
  assert.match(entry.path, /^(backend\/|frontend\/|docs\/manual\/)/);
  const file = safe(path.join(frozen, 'source'), entry.path);
  if (!existsSync(file)) missing.push(entry.path);
  else if (blob(readFileSync(file)) !== entry.oid) different.push(entry.path);
}
assert.deepEqual(missing, []); assert.deepEqual(different, []);
const result = { commit, stage, files: source.files.length, missing, different };
writeFileSync(path.join(out, `source-${stage}.json`), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });

const qa = read(path.join(out, 'qa-manifest.json'));
assert.ok(qa.files.length >= 786);
const qaMismatch: string[] = [];
for (const entry of qa.files) {
  assert.match(entry.path, /^frontend\/cloud-qa\//);
  const file = safe(root, entry.path);
  if (!existsSync(file) || blob(readFileSync(file)) !== entry.oid) qaMismatch.push(entry.path);
}
writeFileSync(path.join(out, `qa-sources-${stage}.json`), JSON.stringify({ stage, files: qa.files.length,
  commit: qa.commit, matched: qaMismatch.length === 0, mismatch: qaMismatch }, null, 2), { flag: 'wx', mode: 0o600 });
assert.deepEqual(qaMismatch, [], 'QA harness differs from the committed version');

const ui = read(path.join(frozen, 'assets-manifest.json'));
const server = read(path.join(backend, 'assets-manifest.json'));
assert.equal(ui.commit, commit);
assert.equal(server.commit, '17e74c8d85dc1cc3854886e3d70f6d62abb0898d');
const binaries: Array<{ base: string; path: string; sha256: string }> = [
  ...ui.entries.map((entry: { file: string; sha256: string }) => ({ base: frozen, path: entry.file, sha256: entry.sha256 })),
  ...server.files.filter((entry: { path: string }) => entry.path.startsWith('dist-backend/'))
    .map((entry: { path: string; sha256: string }) => ({ base: backend, ...entry })),
];
assert.equal(binaries.length, 944);
const binaryMismatch = binaries.filter(entry => {
  const file = safe(entry.base, entry.path);
  return !existsSync(file) || sha256(readFileSync(file)) !== entry.sha256;
}).map(entry => entry.path);
writeFileSync(path.join(out, `compiled-assets-${stage}.json`), JSON.stringify({ stage, files: binaries.length,
  matched: binaryMismatch.length === 0, mismatch: binaryMismatch }, null, 2), { flag: 'wx', mode: 0o600 });
assert.deepEqual(binaryMismatch, [], 'Compiled assets changed');
console.log(`Verified ${source.files.length} product sources, ${qa.files.length} QA sources and ${binaries.length} compiled files (${stage}).`);
