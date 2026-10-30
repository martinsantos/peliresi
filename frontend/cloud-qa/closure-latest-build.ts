/** Compile only committed preview sources after verifying their hashes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026103080';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, 'd7d29dde0a52f7e24e76135151fa2978075f1ca9');
const source = JSON.parse(readFileSync(path.join(out, 'source-manifest.json'), 'utf8')) as Record<string, string>;
const backend = Object.entries(source).filter(([name]) => name.startsWith('backend/src/'));
for (const [name, expected] of backend) assert.equal(createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex'), expected, name);
const files = backend.map(([name]) => name).filter(name => /\.tsx?$/.test(name)
  && !name.includes('/__tests__/') && !name.endsWith('.test.ts')).map(name => path.join(root, name));
assert.ok(files.length > 100); assert.ok(files.every(name => !name.includes('gpsReceptionObservations')));
const config = { extends: '/work/sitrep/backend/tsconfig.build.json',
  compilerOptions: { outDir: '/work/sitrep/backend/dist-qa-closure-d7d29dde' }, include: [], files };
writeFileSync(path.join(out, 'tsconfig-committed.json'), JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
writeFileSync(path.join(out, 'backend-source-proof.json'), JSON.stringify({ commit: process.env.GITHUB_SHA,
  trackedBackendFiles: backend.length, compilationRoots: files.length, mismatches: 0, syntheticPreview: true }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Fuente comprometida verificada: ${backend.length} archivos; ${files.length} raíces.`);
