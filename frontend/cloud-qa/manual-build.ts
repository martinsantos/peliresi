import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/** Freeze the same complete static manual that the QA server serves. No links or secrets. */
export async function synchronizeManual(source: string, build: string, freeze: boolean) {
  async function inventory(directory: string, prefix = ''): Promise<Array<{ file: string; sha256: string }>> {
    assert.equal((await lstat(directory)).isSymbolicLink(), false);
    const files: Array<{ file: string; sha256: string }> = [];
    for (const name of (await readdir(directory)).sort()) {
      assert.ok(!name.startsWith('._') && name !== '.env', 'No metadata or environment secrets');
      const absolute = path.join(directory, name), relative = path.posix.join(prefix, name);
      const info = await lstat(absolute);
      assert.equal(info.isSymbolicLink(), false, 'No external documentation symlinks');
      if (info.isDirectory()) files.push(...await inventory(absolute, relative));
      else {
        assert.equal(info.isFile(), true);
        files.push({ file: relative, sha256: createHash('sha256').update(await readFile(absolute)).digest('hex') });
      }
    }
    return files;
  }
  const expected = await inventory(source);
  assert.ok(expected.some(item => item.file === 'index.html'), 'Require a usable help entry');
  if (freeze) await cp(source, build, { recursive: true });
  assert.deepEqual(await inventory(build), expected, 'Serve and package every tested manual asset, byte for byte');
}
