import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertCloudEnvironment, root } from './safety.ts';
import { assertFullE2EEvidence } from './e2e-evidence.ts';

assertCloudEnvironment(); assert.equal(process.env.QA_MULTIUSER, 'true');
const output = process.env.QA_ARTIFACTS!;
const read = async (name: string) => JSON.parse(await readFile(path.join(output, name), 'utf8'));
const frozen = await read('build-frozen.json'); assert.equal(frozen.commit, process.env.GITHUB_SHA);
const backend = frozen.backendFiles.filter((row: { file: string }) => row.file.startsWith('dist/'));
for (const row of frozen.backendFiles) {
  assert.equal(createHash('sha256').update(await readFile(path.join(root, 'backend', row.file))).digest('hex'), row.sha256, row.file);
}
const units = [await read('backend-unit.json'), await read('frontend-unit.json')];
for (const unit of units) { assert.equal(unit.success, true); assert.equal(unit.numFailedTests + unit.numPendingTests, 0); assert.equal(unit.numPassedTests, unit.numTotalTests); }
assertFullE2EEvidence(await read('e2e.json'));
let browserEvidence = { repeatedThisRun: true, baselineRun: process.env.GITHUB_RUN_ID, baselineCommit: process.env.GITHUB_SHA };
if (process.env.QA_BROWSER_REUSE === 'true') {
  const reuse = await read('browser-reuse.json');
  assert.equal(reuse.baselineRun, '37831212967'); assert.equal(reuse.baselineCommit, '436d830ce3d38beff230719e799d4ed6af8371b4');
  assert.equal(reuse.currentCommit, process.env.GITHUB_SHA); assert.equal(reuse.browserRepeatedThisRun, false);
  assert.equal(reuse.productAndBrowserSourcesUnchanged, true); assert.equal(reuse.backendAndPrismaBytesIdentical, true);
  assert.equal(reuse.originalReportSha256, createHash('sha256').update(await readFile(path.join(output, 'e2e.json'))).digest('hex'));
  browserEvidence = { repeatedThisRun: false, baselineRun: reuse.baselineRun, baselineCommit: reuse.baselineCommit };
}
const http = await read('http-summary.json'); assert.equal(http.passed, 54); assert.equal(http.failed, 0);
for (const [name, passed] of [['expiry-identity.json', 2], ['monitor-calendar.json', 4], ['territorial-access.json', 5], ['support-integration.json', 20], ['operational-coherence.json', 6]] as const) {
  const check = await read(name); assert.equal(check.commit, process.env.GITHUB_SHA); assert.equal(check.passed, passed); assert.equal(check.failed, 0); assert.equal(check.externalProvidersDisabled, true);
}
const load = await read('multiuser.json'), recovery = await read('multiuser-restore.json');
assert.equal(load.commit, process.env.GITHUB_SHA); assert.equal(load.accounts, 50); assert.equal(load.authenticatedAccounts, 50);
assert.equal(load.distinctAccounts, 50); assert.equal(load.externalProvidersDisabled, true); assert.equal(load.productionDataWritten, false);
assert.equal(load.checks.length, 7); assert.ok(load.checks.every((row: { status: string }) => row.status === 'PASS'));
assert.ok(Date.parse(load.endedAt) - Date.parse(load.startedAt) >= 1800000);
assert.deepEqual(load.phases, [{ sessions: 10, seconds: 300 }, { sessions: 25, seconds: 300 }, { sessions: 50, seconds: 1200 }]);
assert.equal(recovery.authenticatedUsers, 50); assert.equal(recovery.originalDownload, true); assert.equal(recovery.numberingContinues, true);
assert.equal(recovery.productionData, false); assert.equal(recovery.restoredDatabase, 'sitrep_night_qa_restore_20261008');
assert.equal((await read('multiuser-closure.json')).clusterStopped, true);
const archive = path.join(output, 'multiuser-tested-backend.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', path.join(root, 'backend'), 'dist']);
const sourceHashes = await Promise.all(['package.json', 'package-lock.json', 'prisma/schema.prisma'].map(async file => ({ file, sha256: createHash('sha256').update(await readFile(path.join(root, 'backend', file))).digest('hex') })));
await writeFile(path.join(output, 'multiuser-tested-backend.json'), JSON.stringify({ commit: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID,
  archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'), files: backend, sourceHashes,
  units: units.map(unit => ({ passed: unit.numPassedTests, failed: unit.numFailedTests, pending: unit.numPendingTests })), e2e: (await read('e2e.json')).stats,
  multiuser: { accounts: 50, seconds: 1800, cluster: 'two Node20 workers', checks: load.checks.length, restore: true },
  builtInCloud: true, rebuiltAfterTesting: false, productionDataWritten: false, scope: 'backend-only', androidRepeated: false, browserEvidence,
  containsEnvironment: false, containsUploads: false, containsDependencies: false }, null, 2));
console.log('Backend-only package frozen after 219 E2E, full unit/HTTP, thirty-minute multiuser and actual restore gates');
