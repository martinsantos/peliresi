/** Recheck committed frontend/manual blobs without reading local backend work. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026103111';
const commit = '971727a3641780d88add1eb9a3ae714988ec44bf';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, commit);
const manifest = JSON.parse(readFileSync(path.join(out, 'product-manifest.json'), 'utf8')) as {
  commit: string; files: Array<{ path: string; oid: string }>;
};
assert.equal(manifest.commit, commit);
assert.equal(manifest.files.length, 911);
const missing: string[] = [], different: string[] = [];
const base = path.resolve(root);
for (const entry of manifest.files) {
  assert.match(entry.path, /^(frontend\/|docs\/manual\/)/);
  assert.doesNotMatch(entry.path, /(?:^|\/)\.\.(?:\/|$)/);
  assert.match(entry.oid, /^[a-f0-9]{40}$/);
  const file = path.resolve(base, entry.path);
  assert.ok(file.startsWith(base + path.sep));
  if (!existsSync(file)) { missing.push(entry.path); continue; }
  const bytes = readFileSync(file);
  const oid = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (oid !== entry.oid) different.push(entry.path);
}
const result = { commit, files: manifest.files.length, missing, different,
  scope: 'frontend and manual, committed blobs', syntheticPreview: true };
writeFileSync(path.join(out, 'source-comparison-final.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
assert.deepEqual(missing, []); assert.deepEqual(different, []);
console.log(`Cotejados ${manifest.files.length} archivos comprometidos de interfaz y manual.`);
