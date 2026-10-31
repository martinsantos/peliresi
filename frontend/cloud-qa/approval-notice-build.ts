/** Compile only an identified committed candidate in the isolated preview. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-approval-notice-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'approval-notice-fix');
assert.match(process.env.GITHUB_SHA || '', /^[a-f0-9]{40}$/);
const source = JSON.parse(readFileSync(path.join(out, 'backend-source-manifest.json'), 'utf8')) as Record<string, string>;
const comparison = JSON.parse(readFileSync(path.join(out, 'source-comparison.json'), 'utf8'));
assert.equal(comparison.commit, process.env.GITHUB_SHA);
assert.deepEqual(comparison.missing, []); assert.deepEqual(comparison.mismatch, []);
const backend = Object.entries(source).filter(([name]) => name.startsWith('backend/src/'));
for (const [name, expected] of backend) assert.equal(createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex'), expected, name);
const files = backend.map(([name]) => name).filter(name => /\.tsx?$/.test(name)
  && !name.includes('/__tests__/') && !name.endsWith('.test.ts')).map(name => path.join(root, name));
assert.ok(files.length > 100); assert.ok(files.every(name => !name.includes('gpsReceptionObservations')));
const output = '/work/sitrep/backend/dist-qa-approval-notice-20261030';
assert.equal(existsSync(output), false, 'Never overwrite an earlier build');
writeFileSync(path.join(out, 'tsconfig-committed.json'), JSON.stringify({ extends: '/work/sitrep/backend/tsconfig.build.json',
  compilerOptions: { outDir: output }, include: [], files }, null, 2), { flag: 'wx', mode: 0o600 });
writeFileSync(path.join(out, 'backend-source-proof.json'), JSON.stringify({ commit: process.env.GITHUB_SHA,
  trackedBackendFiles: backend.length, compilationRoots: files.length, mismatches: 0, syntheticPreview: true,
  controllerSource: 'committed', uncommittedGpsIncluded: false }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Fuente comprometida verificada: ${backend.length} archivos; ${files.length} raíces.`);
