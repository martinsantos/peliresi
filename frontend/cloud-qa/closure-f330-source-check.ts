import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026110104';
const commit = 'f3307f3f2da134b39e589ec63b4d57758f8fe03f';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'closure-f3307f3f');
assert.equal(process.env.GITHUB_SHA, commit);
const stage = process.env.QA_SOURCE_STAGE;
assert.ok(stage === 'before' || stage === 'after');
const manifest = JSON.parse(readFileSync(path.join(out, 'product-manifest.json'), 'utf8')) as { commit: string; files: Array<{ path: string; oid: string }> };
assert.equal(manifest.commit, commit); assert.equal(manifest.files.length, 911);
assert.equal(new Set(manifest.files.map(entry => entry.path)).size, manifest.files.length);
const missing: string[] = [], different: string[] = [];
for (const entry of manifest.files) {
  assert.match(entry.path, /^(frontend\/|docs\/manual\/)/);
  assert.doesNotMatch(entry.path, /(?:^|\/)\.\.(?:\/|$)/);
  assert.match(entry.oid, /^[a-f0-9]{40}$/);
  const file = path.resolve(root, entry.path);
  assert.ok(file.startsWith(path.resolve(root) + path.sep));
  if (!existsSync(file)) { missing.push(entry.path); continue; }
  const bytes = readFileSync(file);
  if (createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== entry.oid) different.push(entry.path);
}
writeFileSync(path.join(out, `source-${stage}.json`), JSON.stringify({ commit, stage,
  files: manifest.files.length, missing, different, syntheticPreview: true }, null, 2), { flag: 'wx', mode: 0o600 });
assert.deepEqual(missing, []); assert.deepEqual(different, []);
console.log(`Verificados ${manifest.files.length} archivos de interfaz y manual (${stage}).`);
