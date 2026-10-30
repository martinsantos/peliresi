/** Compile only the committed backend baseline plus the receipt-mail change. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-receipt-document-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const mail = 'backend/src/services/notification-mail.service.ts';
assert.match(process.env.QA_MAIL_SOURCE_SHA || '', /^[a-f0-9]{64}$/);
const manifest = JSON.parse(readFileSync('/work/sitrep/.qa-closure-67f330a7/source-manifest.json', 'utf8')) as Record<string, string>;
const backend = Object.entries(manifest).filter(([name]) => name.startsWith('backend/src/')
  && !name.includes('/__tests__/') && !name.endsWith('.test.ts'));
for (const [name, expected] of backend) {
  const actual = createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex');
  assert.equal(actual, name === mail ? process.env.QA_MAIL_SOURCE_SHA : expected, name);
}
const files = backend.map(([name]) => name).filter(name => /\.tsx?$/.test(name)).map(name => path.join(root, name));
assert.ok(files.length > 100); assert.ok(files.every(name => !name.includes('gpsReceptionObservations')));
const output = '/work/sitrep/backend/dist-qa-receipt-document-20261030';
assert.equal(existsSync(output), false);
writeFileSync(path.join(out, 'tsconfig-backend.json'), JSON.stringify({ extends: '/work/sitrep/backend/tsconfig.build.json',
  compilerOptions: { outDir: output }, include: [], files }, null, 2), { flag: 'wx', mode: 0o600 });
writeFileSync(path.join(out, 'backend-source-proof.json'), JSON.stringify({ baseline: '67f330a7', mailSha256: process.env.QA_MAIL_SOURCE_SHA,
  committedBackendFiles: backend.length, compilationRoots: files.length, otherChanges: 0, syntheticPreview: true }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Backend de QA: ${backend.length} archivos de base verificados, más el cambio de correo.`);
