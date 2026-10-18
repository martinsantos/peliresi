/** Email-only derivative. Does not replace the installed application's identity. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const sharp = require('sharp');
sharp.concurrency(1);
sharp.cache(false);
const source = await readFile(new URL('../../frontend/public/mail-sitrep-rotonda.svg', import.meta.url));
const paths = [...source.toString().matchAll(/\bd="([^"]+)"/g)].map(match => match[1]);
assert.equal(paths.length, 3);
assert.equal(new Set(paths).size, 1);
assert(!/<(?:script|image|foreignObject)\b|href=/.test(source.toString()));
const result = await sharp(source).resize(192, 192).png().toBuffer();
const destination = new URL('../../frontend/public/mail-sitrep-rotonda.png', import.meta.url);
if (process.argv.includes('--check')) {
  assert.deepEqual(await sharp(await readFile(destination)).raw().toBuffer(), await sharp(result).raw().toBuffer());
} else await writeFile(destination, result);
console.log(JSON.stringify({ equalSegments: 3, bytes: result.length, verified: process.argv.includes('--check') }));
