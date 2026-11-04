import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_EXECUTOR, 'preview-container');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const out = process.env.QA_ARTIFACTS!;
assert(['/work/sitrep/.qa-ocr-lock-20261029', '/work/sitrep/.qa-ocr-fifo-20261029'].includes(out));
const fixture = path.join(out, 'factura-artificial.png');
const mode = process.env.QA_OCR_CASE || '';
assert.match(mode, /^(prepare|prepare-root|existing-root|existing-node|created-root|created-node|unreadable-node|symlink-node|contention)$/);
const { readReceipt } = backendRequire('./dist/services/documentAnalysis.service.js');
const { electricityReading } = backendRequire('./dist/domain/electricityReading.js');
const uid = process.getuid!();
const save = (data: object) => fs.writeFileSync(path.join(out, `ocr-${mode}.json`), JSON.stringify({ synthetic: true, ...data }, null, 2) + '\n');
const lockName = 'sitrep-receipt-ocr.lock';

if (mode === 'prepare') {
  assert.equal(uid, 1000);
  const sharp = backendRequire('sharp');
  const lines = ['EDEMSA', 'FACTURA ARTIFICIAL SIN VALIDEZ', 'Tarifa: T2 R BT', 'Consumo facturado: 1250 kWh', 'Potencia contratada: 45 kW', 'NIC: 900000001'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/>${lines.map((line, index) => `<text x="50" y="${70 + index * 75}" font-family="DejaVu Sans" font-size="32">${line}</text>`).join('')}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(fixture);
  save({ fixtureSha256: createHash('sha256').update(fs.readFileSync(fixture)).digest('hex') });
} else if (mode === 'prepare-root') {
  assert.equal(uid, 0);
  for (const name of ['tmp-shared', 'tmp-denied', 'tmp-symlink']) {
    const dir = path.join(out, name);
    fs.mkdirSync(dir, { mode: 0o777 }); fs.chmodSync(dir, 0o1777);
  }
  fs.writeFileSync(path.join(out, 'tmp-denied', lockName), '', { flag: 'wx', mode: 0o600 });
  fs.chmodSync(path.join(out, 'tmp-denied', lockName), 0o600);
  fs.symlinkSync(fixture, path.join(out, 'tmp-symlink', lockName));
  save({ directories: 3, intentionallyUnreadableLock: true, intentionalSymlink: true });
} else if (mode === 'contention') {
  assert.equal(uid, 0); assert.equal(os.tmpdir(), '/tmp');
  const lock = path.join(os.tmpdir(), lockName);
  assert.equal(fs.statSync(lock).uid, 1000);
  const holderProgram = 'process.stdout.write("READY\\n"); setTimeout(()=>{}, 2500)';
  const ready = async (child: ChildProcess) => {
    assert(child.stdout);
    const closed = once(child, 'close');
    await Promise.race([once(child.stdout, 'data'), closed.then(() => { throw new Error('lock holder exited before ready'); })]);
    return { closed };
  };
  // A legacy worker locks the ordinary path while the corrected worker reads.
  const old = spawn('runuser', ['-u', 'node', '--', 'flock', '-F', '-n', '-E', '75', lock, process.execPath, '-e', holderProgram], { stdio: ['ignore', 'pipe', 'pipe'] });
  const { closed: oldClosed } = await ready(old);
  const busy = await readReceipt({ path: fixture, mimeType: 'image/png' }, 'FACTURA_ELECTRICA');
  assert.equal(busy.lectura, 'NO_DISPONIBLE'); assert.match(busy.aviso, /ocupada/);
  assert.equal((await oldClosed)[0], 0);
  // The new descriptor path still blocks a legacy worker on the ordinary path.
  const fd = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const modern = spawn('flock', ['-F', '-n', '-E', '75', `/proc/${process.pid}/fd/${fd}`, process.execPath, '-e', holderProgram], { stdio: ['ignore', 'pipe', 'pipe'] });
    const { closed: modernClosed } = await ready(modern);
    const legacy = spawnSync('runuser', ['-u', 'node', '--', 'flock', '-n', '-E', '75', lock, 'true']);
    assert.equal(legacy.status, 75);
    assert.equal((await modernClosed)[0], 0);
  } finally { fs.closeSync(fd); }
  save({ oldBlocksNew: true, newBlocksOld: true, busyReported: true });
} else {
  assert.equal(uid, mode.endsWith('root') ? 0 : 1000);
  const expectedDir = mode.startsWith('existing') ? '/tmp' : path.join(out, mode.startsWith('created') ? 'tmp-shared' : mode.startsWith('unreadable') ? 'tmp-denied' : 'tmp-symlink');
  assert.equal(os.tmpdir(), expectedDir);
  const originalHash = createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
  const result = await readReceipt({ path: fixture, mimeType: 'image/png' }, 'FACTURA_ELECTRICA');
  const unavailable = mode.startsWith('unreadable') || mode.startsWith('symlink');
  if (unavailable) {
    assert.equal(result.lectura, 'NO_DISPONIBLE'); assert.match(result.aviso, /archivo se conserva/);
    assert.equal(createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'), originalHash);
  } else {
    assert.equal(result.lectura, 'LEIDO'); assert.equal(result.motor, 'TESSERACT');
    const fields = electricityReading(result.texto).campos;
    assert.equal(fields.categoriaTarifaria, 'T2RBT'); assert.equal(fields.consumoKwh, '1250'); assert.equal(fields.potenciaContratadaKw, '45');
  }
  const stat = fs.lstatSync(path.join(expectedDir, lockName));
  if (mode === 'created-root' || mode === 'created-node') { assert.equal(stat.uid, 0); assert.equal(stat.mode & 0o777, 0o644); }
  if (mode.startsWith('existing')) { assert.equal(stat.uid, 1000); assert.equal(stat.mode & 0o777, 0o644); }
  save({ uid, status: result.lectura, lockOwner: stat.uid, lockMode: (stat.mode & 0o777).toString(8), symlink: stat.isSymbolicLink(), fixtureUnchanged: true });
}
console.log(`OCR preview ${mode}: OK`);
