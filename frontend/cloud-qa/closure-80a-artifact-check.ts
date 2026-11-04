import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026110103';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'closure-80a283bb');
assert.equal(process.env.GITHUB_SHA, '80a283bb7987a1906c8857eb5b147b2054d30b68');
const stage = process.env.QA_SOURCE_STAGE;
assert.ok(stage === 'before' || stage === 'after');
const qa = JSON.parse(readFileSync(path.join(out, 'qa-manifest.json'), 'utf8')) as { commit: string; files: Array<{ path: string; oid: string }> };
assert.equal(qa.commit, 'ef73835d'); assert.equal(qa.files.length, 771);
const compiled = JSON.parse(readFileSync(path.join(out, 'compiled-manifest.json'), 'utf8')) as { product: string; source: string; files: Array<{ path: string; sha256: string }> };
assert.equal(compiled.product, process.env.GITHUB_SHA); assert.equal(compiled.source, 'encrypted-preview-backup');
assert.equal(compiled.files.length, 948);
for (const [kind, entries] of [['qa', qa.files], ['compiled', compiled.files]] as const) {
  const mismatch: string[] = [];
  assert.equal(new Set(entries.map(entry => entry.path)).size, entries.length);
  for (const entry of entries) {
    if (kind === 'qa') assert.match(entry.path, /^frontend\/cloud-qa\//);
    else assert.match(entry.path, /^\.qa-(?:gps-empty-20261101\/(?:web-visual|app-visual)|scheduled-pause-20261101\/dist)\//);
    assert.doesNotMatch(entry.path, /(?:^|\/)\.\.(?:\/|$)/);
    const file = path.resolve(root, entry.path);
    assert.ok(file.startsWith(path.resolve(root) + path.sep));
    if (!existsSync(file)) { mismatch.push(entry.path); continue; }
    const bytes = readFileSync(file);
    const actual = kind === 'qa'
      ? createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
      : createHash('sha256').update(bytes).digest('hex');
    if (actual !== ('oid' in entry ? entry.oid : entry.sha256)) mismatch.push(entry.path);
  }
  const name = kind === 'qa' ? `qa-sources-${stage}.json` : `compiled-assets-${stage}.json`;
  writeFileSync(path.join(out, name), JSON.stringify({ stage, files: entries.length, matched: mismatch.length === 0, mismatch }, null, 2), { flag: 'wx', mode: 0o600 });
  assert.deepEqual(mismatch, [], `${kind} files changed`);
  console.log(`${kind}: ${entries.length} archivos cotejados (${stage}).`);
}
