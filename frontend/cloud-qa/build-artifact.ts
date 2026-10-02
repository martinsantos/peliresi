import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudEnvironment, root } from './safety.ts';

assertCloudEnvironment();
const output = process.env.QA_ARTIFACTS!;
const mode = process.argv[2];
assert.ok(['freeze', 'package'].includes(mode));
const manualSource = path.join(root, 'docs/manual/directorio.html');
const manualBuild = path.join(root, 'frontend/dist/manual/directorio.html');
if (mode === 'freeze') {
  await mkdir(path.dirname(manualBuild), { recursive: true });
  await copyFile(manualSource, manualBuild);
}
assert.deepEqual(await readFile(manualBuild), await readFile(manualSource), 'Package the same manual served during QA, without replacing its other assets');
type Item = { file: string; sha256: string };
async function inventory(directory: string, prefix: string): Promise<Item[]> {
  const items: Item[] = [];
  for (const name of (await readdir(directory)).sort()) {
    assert.ok(!name.startsWith('._') && name !== '.env', 'No local metadata or environment secrets');
    const file = path.posix.join(prefix, name);
    const absolute = path.join(directory, name);
    const info = await lstat(absolute);
    assert.equal(info.isSymbolicLink(), false, 'No dependency symlinks in build artifact');
    if (info.isDirectory()) items.push(...await inventory(absolute, file));
    else {
      assert.equal(info.isFile(), true);
      items.push({ file, sha256: createHash('sha256').update(await readFile(absolute)).digest('hex') });
    }
  }
  return items;
}
const files = [...await inventory(path.join(root, 'frontend/dist'), 'dist'),
  ...await inventory(path.join(root, 'frontend/dist-app'), 'dist-app')];
assert.ok(files.length > 50 && files.length < 5000);
assert.ok(files.some(item => item.file === 'dist/index.html'));
assert.ok(files.some(item => item.file === 'dist-app/app.html'));
const readJson = async (name: string) => JSON.parse(await readFile(path.join(output, name), 'utf8'));
if (mode === 'freeze') {
  await writeFile(path.join(output, 'build-frozen.json'), JSON.stringify({ commit: process.env.GITHUB_SHA, files }, null, 2));
  console.log('Frozen complete web/app inventory before serving any test');
} else {
  const frozen = await readJson('build-frozen.json');
  assert.equal(frozen.commit, process.env.GITHUB_SHA);
  assert.deepEqual(files, frozen.files, 'Never package rebuilt or changed bytes after testing');
  const units = [await readJson('backend-unit.json'), await readJson('frontend-unit.json')];
  for (const unit of units) {
    assert.equal(unit.success, true);
    assert.equal(unit.numFailedTests + unit.numPendingTests, 0);
    assert.ok(unit.numPassedTests > 0);
  }
  const e2e = await readJson('e2e.json');
  assert.equal(e2e.stats.expected, 63);
  assert.equal(e2e.stats.unexpected + e2e.stats.flaky + e2e.stats.skipped, 0);
  assert.deepEqual(e2e.errors, []);
  const android = await readJson('android/result.json');
  const apk = await readJson('apk/result.json');
  assert.equal(android.completed,true,'An interrupted Android suite cannot pass the package gate');
  assert.equal(android.failed + apk.failed, 0);
  assert.equal(android.passed, 12);
  assert.equal(apk.passed, 4);
  const archive = path.join(output, 'tested-frontend.tar.gz');
  execFileSync('tar', ['-czf', archive, '-C', path.join(root, 'frontend'), 'dist', 'dist-app'], { timeout: 30000 });
  await writeFile(path.join(output, 'tested-build.json'), JSON.stringify({
    commit: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID,
    archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'), files,
    units: units.map(unit => ({ passed: unit.numPassedTests, failed: unit.numFailedTests, pending: unit.numPendingTests })),
    e2e: e2e.stats, android: { passed: android.passed, failed: android.failed }, apk: { passed: apk.passed, failed: apk.failed },
    builtInCloud: true, rebuiltAfterTesting: false, productionDataWritten: false,
  }, null, 2));
  console.log('Exact tested web/app archive retained after all gates passed; no dependencies or backend secrets');
}
