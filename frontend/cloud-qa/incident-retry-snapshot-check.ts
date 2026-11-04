import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-incident-retry-final-20261101';
const commit = '17e74c8d85dc1cc3854886e3d70f6d62abb0898d';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.GITHUB_SHA, commit);
const stage = process.env.QA_SOURCE_STAGE; assert.ok(stage === 'before' || stage === 'after');
const manifest = JSON.parse(readFileSync(path.join(out, 'source-manifest.json'), 'utf8')) as { commit: string; files: Array<{ path: string; oid: string }> };
assert.equal(manifest.commit, commit); assert.equal(manifest.files.length, 2674);
assert.equal(new Set(manifest.files.map(x => x.path)).size, manifest.files.length);
const missing: string[] = [], different: string[] = [], source = path.join(out, 'source');
for (const entry of manifest.files) {
  assert.match(entry.path, /^(backend\/|frontend\/|docs\/manual\/)/);
  assert.doesNotMatch(entry.path, /(?:^|\/)\.\.(?:\/|$)/);
  assert.match(entry.oid, /^[a-f0-9]{40}$/);
  const file = path.resolve(source, entry.path); assert.ok(file.startsWith(path.resolve(source) + path.sep));
  if (!existsSync(file)) { missing.push(entry.path); continue; }
  const bytes = readFileSync(file);
  if (createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== entry.oid) different.push(entry.path);
}
writeFileSync(path.join(out, `source-${stage}.json`), JSON.stringify({ commit, files: manifest.files.length, missing, different, synthetic: true }, null, 2), { flag: 'wx', mode: 0o600 });
assert.deepEqual(missing, []); assert.deepEqual(different, []);
console.log(`Cotejados ${manifest.files.length} archivos confirmados (${stage}).`);
