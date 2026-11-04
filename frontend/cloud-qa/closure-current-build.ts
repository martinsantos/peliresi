/** Compile a known commit, excluding unrelated files left in the preview checkout. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026103070';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, '67f330a711e5d12b268897d22366b428cf44b44f');
const source = JSON.parse(readFileSync('/work/sitrep/.qa-closure-67f330a7/source-manifest.json', 'utf8')) as Record<string, string>;
const backend = Object.entries(source).filter(([name]) => name.startsWith('backend/src/'));
for (const [name, expected] of backend) {
  const actual = createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex');
  assert.equal(actual, expected, name);
}
const files = backend.map(([name]) => name).filter(name => /\.tsx?$/.test(name)
  && !name.includes('/__tests__/') && !name.endsWith('.test.ts')).map(name => path.join(root, name));
assert.ok(files.length > 100);
assert.ok(files.every(name => !name.includes('gpsReceptionObservations')));
const config = { extends: '/work/sitrep/backend/tsconfig.build.json',
  compilerOptions: { outDir: '/work/sitrep/backend/dist-qa-closure-67f330a7' }, include: [], files };
writeFileSync(path.join(out, 'tsconfig-committed.json'), JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
writeFileSync(path.join(out, 'backend-source-proof.json'), JSON.stringify({ commit: process.env.GITHUB_SHA,
  trackedBackendFiles: backend.length, compilationRoots: files.length, mismatches: 0, syntheticPreview: true }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Fuente comprometida verificada: ${backend.length} archivos; ${files.length} raíces de compilación.`);
