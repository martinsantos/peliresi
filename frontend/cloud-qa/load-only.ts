import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, assertCloudEnvironment, root } from './safety.ts';

// Additional load evidence for the already-published bytes. No frontend build,
// browser, emulator, production request, new deploy package or automatic deploy.
assertCloudEnvironment();
const output = process.env.QA_ARTIFACTS!;
const artifact = process.env.QA_TESTED_BUILD!;
assert.ok(process.env.RUNNER_TEMP);
assert.ok(path.isAbsolute(artifact) && artifact.startsWith(process.env.RUNNER_TEMP! + '/'));
const meta = JSON.parse(readFileSync(path.join(artifact, 'tested-backend.json'), 'utf8'));
assert.equal(meta.commit, 'caa5d6056912c6694d5472d323d36b3fafede175');
assert.equal(meta.run, '37094888323');
assert.equal(meta.builtInCloud, true);
assert.equal(meta.rebuiltAfterTesting, false);
assert.equal(meta.productionDataWritten, false);
for (const key of ['containsDependencies', 'containsEnvironment', 'containsUploads']) assert.equal(meta[key], false);
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const archive = path.join(artifact, 'tested-backend.tar.gz');
assert.equal(sha(archive), meta.archiveSha256);
// Fetch depth2 contains this QA-only child and the precise published parent.
assert.equal(execFileSync('git', ['diff', '--name-only', meta.commit, 'HEAD', '--',
  'backend/src', 'backend/package.json', 'backend/package-lock.json', 'backend/prisma'],
{ cwd: root, encoding: 'utf8' }).trim(), '', 'Never load-test a different backend and call it the published product');
for (const item of meta.sourceHashes) assert.equal(sha(path.join(root, 'backend', item.file)), item.sha256);
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
for (const entry of entries) {
  const file = entry.replace(/\/$/, '');
  assert.ok(file === 'dist' || file.startsWith('dist/'));
  assert.ok(file.split('/').every(part => part && part !== '.' && part !== '..'));
}
assert.ok(execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' }).trim().split('\n')
  .every(row => row.startsWith('-') || row.startsWith('d')), 'No links/devices in the tested archive');
assert.equal(existsSync(path.join(root, 'backend/dist')), false);
execFileSync('tar', ['-xzf', archive, '-C', path.join(root, 'backend')]);
function inventory(directory: string, prefix = 'dist'): Array<{ file: string; sha256: string }> {
  return readdirSync(directory).sort().flatMap(name => {
    const file = prefix + '/' + name, full = path.join(directory, name), stat = lstatSync(full);
    assert.equal(stat.isSymbolicLink(), false);
    if (stat.isDirectory()) return inventory(full, file);
    assert.ok(stat.isFile());return [{ file, sha256: sha(full) }];
  });
}
assert.deepEqual(inventory(path.join(root, 'backend/dist')), meta.files);
await assertCloudDatabase();
mkdirSync(output, { recursive: true });
const log = openSync(path.join(output, 'runtime.ts.log'), 'a');
const runtime = spawn(process.execPath, ['--experimental-strip-types', path.join(root, 'frontend/cloud-qa/runtime.ts')], {
  cwd: root, env: process.env, detached: true, stdio: ['ignore', log, log],
});
runtime.unref();
await writeFile(path.join(output, 'processes.json'), JSON.stringify([{ pid: runtime.pid!, file: 'runtime.ts' }]));
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3037/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.status === 200 && (await response.json()).db === 'connected') { ready = true;break; }
    } catch { /* A spawned process is not HTTP-ready yet; bounded startup only. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Verified backend must be ready before synthetic writes');
  await writeFile(path.join(output, 'load-provenance.json'), JSON.stringify({
    productCommit: meta.commit, productRun: meta.run, qaCommit: process.env.GITHUB_SHA,
    archiveSha256: meta.archiveSha256, files: meta.files.length, rebuilt: false,
    database: 'sitrep_night_qa_20260926', target: 'http://127.0.0.1:3037/api',
    frontendBrowserEmulator: false, productionWritten: false,
  }, null, 2));
  const loadLog = openSync(path.join(output, 'load.log'), 'a');
  execFileSync(process.execPath, [path.join(root, 'backend/node_modules/ts-node/dist/bin.js'),
    'tests/integration/night-load.ts'], {
    cwd: path.join(root, 'backend'), env: process.env, timeout: 150000,
    stdio: ['ignore', loadLog, loadLog],
  });
  const reports = readdirSync(output).filter(file => /^load-50-[\da-f-]+\.json$/.test(file));
  assert.equal(reports.length, 1);
  const report = JSON.parse(readFileSync(path.join(output, reports[0]), 'utf8'));
  assert.equal(report.checks.length, 8, 'Every announced load/recovery check must finish');
  assert.ok(report.checks.every((row: { status: string }) => row.status === 'PASS'));
  console.log('Exact published backend: eight load/recovery checks PASS; 50 synthetic concurrent trips, not 50 physical phones');
} finally {
  execFileSync(process.execPath, ['--experimental-strip-types', path.join(root, 'frontend/cloud-qa/close.ts')], {
    cwd: root, env: process.env, timeout: 15000, stdio: 'inherit',
  });
}
