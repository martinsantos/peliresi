/** Deterministic derivatives of the one vector source; no network or browser. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'backend/package.json'));
const sharp = require('sharp');
sharp.concurrency(1);
sharp.cache(false);
const dir = path.join(root, 'frontend/public');
const source = await readFile(path.join(dir, 'favicon.svg'), 'utf8');
const approved = await readFile(path.join(dir, 'mail-sitrep-rotonda.svg'), 'utf8');
assert.equal(source.trim(), approved.trim(), 'Use the approved recycling/roundabout mark');
assert(!/<(?:script|image|foreignObject)\b|href=/.test(source));
const check = process.argv.includes('--check');
const manualMark = path.join(root, 'docs/manual/sitrep-mark.svg');
if (check) assert.equal((await readFile(manualMark, 'utf8')).trim(), source.trim());
else await writeFile(manualMark, source);
for (const [name, bytes] of [
  ['icon.svg', Buffer.from(source)],
  ['icon-192.svg', Buffer.from(source.replace('<svg ', '<svg width="192" height="192" '))],
  ['icon-192.png', await sharp(Buffer.from(source)).resize(192, 192).png().toBuffer()],
  ['icon-512.png', await sharp(Buffer.from(source)).resize(512, 512).png().toBuffer()],
] as const) {
  if (check) {
    const current = await readFile(path.join(dir, name));
    if (name.endsWith('.png')) {
      // Compare pixels: PNG encoder differences between macOS/Linux are irrelevant.
      assert.deepEqual(await sharp(current).raw().toBuffer(), await sharp(bytes).raw().toBuffer(), name);
    } else assert.deepEqual(current, bytes, name);
  } else await writeFile(path.join(dir, name), bytes);
}
console.log(JSON.stringify({ brand: 'SITREP: trazabilidad', sourceBytes: Buffer.byteLength(source), derivatives: 4, mode: check ? 'verified' : 'generated' }));
