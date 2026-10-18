import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { synchronizeManual } from './manual-build.ts';

test('packages the complete manual with unchanged guide, script and capture bytes', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'sitrep-manual-contract-'));
  try {
    const source = path.join(temporary, 'source'), build = path.join(temporary, 'build');
    await mkdir(path.join(source, 'screenshots/mobile'), { recursive: true });
    for (const file of ['index.html', 'directorio.html', 'help-data.js', 'manual.js', 'manual.css', 'screenshots/mobile/qa.png']) {
      await writeFile(path.join(source, file), 'exact bytes: ' + file);
    }
    await synchronizeManual(source, build, true);
    for (const file of ['index.html', 'help-data.js', 'screenshots/mobile/qa.png']) {
      assert.deepEqual(await readFile(path.join(build, file)), await readFile(path.join(source, file)));
    }
    await synchronizeManual(source, build, false);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('rejects changed or missing packaged documentation rather than certifying source-only QA', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'sitrep-manual-contract-'));
  try {
    const source = path.join(temporary, 'source'), build = path.join(temporary, 'build');
    await mkdir(source); await writeFile(path.join(source, 'index.html'), 'SITREP');
    await synchronizeManual(source, build, true);
    await writeFile(path.join(build, 'index.html'), 'different bytes');
    await assert.rejects(synchronizeManual(source, build, false));
    await rm(path.join(build, 'index.html'));
    await assert.rejects(synchronizeManual(source, build, false));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('rejects symlinked documentation outside the owned source', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'sitrep-manual-contract-'));
  try {
    const source = path.join(temporary, 'source'), build = path.join(temporary, 'build');
    await mkdir(source); await writeFile(path.join(source, 'index.html'), 'SITREP');
    await symlink('/etc/hosts', path.join(source, 'external.txt'));
    await assert.rejects(synchronizeManual(source, build, true));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
