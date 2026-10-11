import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudEnvironment, root } from './safety.ts';

assertCloudEnvironment();
const output = process.env.QA_ARTIFACTS!;
const mode = process.argv[2];
assert.ok(['freeze', 'package'].includes(mode));
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
type Item = { file: string; sha256: string };
function inventory(directory: string, prefix: string): Item[] {
  return readdirSync(directory).sort().flatMap(name => {
    assert.ok(!name.startsWith('._') && name !== '.env');
    const absolute = path.join(directory, name), file = prefix + '/' + name;
    const stat = lstatSync(absolute);
    assert.equal(stat.isSymbolicLink(), false);
    if (stat.isDirectory()) return inventory(absolute, file);
    assert.ok(stat.isFile()); return [{ file, sha256: hash(absolute) }];
  });
}
const front = [...inventory(path.join(root, 'frontend/dist'), 'dist'), ...inventory(path.join(root, 'frontend/dist-app'), 'dist-app')];
const back = [...inventory(path.join(root, 'backend/dist'), 'dist'),
  ...inventory(path.join(root, 'backend/node_modules/.prisma/client'), 'node_modules/.prisma/client'),
  ...inventory(path.join(root, 'backend/node_modules/@prisma/client'), 'node_modules/@prisma/client'),
  ...['prisma/schema.prisma', 'prisma/migrations/20261011190000_account_pending_mail/migration.sql'].map(file => ({ file, sha256: hash(path.join(root, 'backend', file)) }))];
assert.ok(back.some(item => item.file.endsWith('libquery_engine-rhel-openssl-3.0.x.so.node')));
assert.ok(front.some(item => item.file === 'dist-app/index.html'));
const snapshot = { commit: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID, front, back };
const read = (name: string) => JSON.parse(readFileSync(path.join(output, name), 'utf8'));
if (mode === 'freeze') {
  writeFileSync(path.join(output, 'mail-build-frozen.json'), JSON.stringify(snapshot, null, 2), { flag: 'wx' });
} else {
  assert.deepEqual(snapshot, read('mail-build-frozen.json'), 'No rebuild or modified bytes after HTTP/E2E');
  const unit = read('frontend-unit.json'), http = read('account-mail-http.json'), e2e = read('e2e.json');
  assert.equal(unit.numPassedTests, 1380); assert.equal(unit.numFailedTests + unit.numPendingTests, 0);
  assert.equal(http.passed, true); assert.equal(http.smtpEnabled, false); assert.equal(http.checks.length, 8);
  assert.equal(e2e.stats.expected, 81); assert.equal(e2e.stats.unexpected + e2e.stats.flaky + e2e.stats.skipped, 0);
  const archives = [];
  for (const [name, directory, files] of [['frontend', 'frontend', front], ['backend', 'backend', back]] as const) {
    const archive = `mail-tested-${name}.tar.gz`;
    execFileSync('tar', ['-czf', path.join(output, archive), '-C', path.join(root, directory), ...files.map(item => item.file)]);
    archives.push({ file: archive, sha256: hash(path.join(output, archive)) });
  }
  const sourceHashes = ['package.json', 'package-lock.json', 'prisma/schema.prisma'].map(file => ({ file, sha256: hash(path.join(root, 'backend', file)) }));
  writeFileSync(path.join(output, 'mail-tested-build.json'), JSON.stringify({ ...snapshot, archives, sourceHashes,
    frontendUnits: 1380, httpGroups: 8, e2e: e2e.stats, builtInCloud: true, rebuiltAfterTesting: false,
    containsEnvironment: false, containsUploads: false, containsDependencies: 'prisma-client-only', deployment: false }, null, 2), { flag: 'wx' });
}
console.log(`Mail release ${mode}: exact byte inventories recorded; no production access`);
