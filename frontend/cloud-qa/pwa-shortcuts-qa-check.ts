import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-pwa-shortcuts-20261031';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'pwa-shortcuts-20261031');
assert.equal(process.env.GITHUB_SHA, '1d391e38a9071eba7e64350c543eb8286a605049');
const stage = process.env.QA_SOURCE_STAGE;
assert.ok(stage === 'before' || stage === 'after');
const expected = JSON.parse(readFileSync(path.join(out, 'qa-digests.json'), 'utf8')) as Record<string, string>;
const entries = Object.entries(expected);
assert.ok(entries.length >= 57);
for (const [file, digest] of entries) {
  assert.match(file, /^(frontend\/cloud-qa\/|frontend\/src-v6\/__tests__\/|backend\/src\/__tests__\/(?:services\/(?:inspection|apiAdmissionStore)|middlewares\/(?:trainingAnalytics|apiAdmission)|helpers\/admissionStore))/);
  assert.doesNotMatch(file, /(?:^|\/)\.\.(?:\/|$)/);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex'), digest, file);
}
writeFileSync(path.join(out, `qa-sources-${stage}.json`), JSON.stringify({ stage, files: entries.length, matched: true }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Verificados ${entries.length} archivos de pruebas y resguardos (${stage}).`);
