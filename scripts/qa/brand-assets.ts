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
// Installed adaptive icons need their own safe zone; do not crop the standard mark.
const maskable = source.replace('<g fill=', '<g transform="translate(15 15) scale(.7)" fill=');
assert.notEqual(maskable, source);
const transparent = source.replace('<rect width="100" height="100" fill="#FFFFFF"/>', '');
assert.equal((await readFile(path.join(dir, 'sitrep-mark-green.svg'), 'utf8')).trim(), transparent.trim());
const manualMark = path.join(root, 'docs/manual/sitrep-mark.svg');
if (check) assert.equal((await readFile(manualMark, 'utf8')).trim(), source.trim());
else await writeFile(manualMark, source);
for (const [name, bytes] of [
  ['icon.svg', Buffer.from(source)],
  ['icon-192.svg', Buffer.from(source.replace('<svg ', '<svg width="192" height="192" '))],
  ['icon-192.png', await sharp(Buffer.from(source)).resize(192, 192).png().toBuffer()],
  ['icon-512.png', await sharp(Buffer.from(source)).resize(512, 512).png().toBuffer()],
  ['icon-maskable-512.png', await sharp(Buffer.from(maskable)).resize(512, 512).png().toBuffer()],
] as const) {
  if (check) {
    const current = await readFile(path.join(dir, name));
    if (name.endsWith('.png')) {
      // Compare pixels: PNG encoder differences between macOS/Linux are irrelevant.
      assert.deepEqual(await sharp(current).raw().toBuffer(), await sharp(bytes).raw().toBuffer(), name);
    } else assert.deepEqual(current, bytes, name);
  } else await writeFile(path.join(dir, name), bytes);
}
console.log(JSON.stringify({ brand: 'SITREP: trazabilidad', sourceBytes: Buffer.byteLength(source), derivatives: 5, mode: check ? 'verified' : 'generated' }));

// The installed mark must stay entirely inside the maskable 40%-radius safe circle.
const { data, info } = await sharp(await readFile(path.join(dir, 'icon-maskable-512.png'))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let greenPixels = 0;
for (let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
 const i=(y*info.width+x)*info.channels;
 if(data[i]<240||data[i+1]<240||data[i+2]<240) {
  greenPixels++;
  assert(Math.hypot(x+.5-info.width/2,y+.5-info.height/2)<=info.width*.4, 'Adaptive mask cuts the mark');
 }
}
assert(greenPixels>5000, 'The installed icon must contain a visible mark');
console.log(JSON.stringify({maskableSafeZone:true,greenPixels}));
