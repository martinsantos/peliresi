import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-evidence-focus-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.UPLOADS_DIR, path.join(out, 'uploads'));
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');

// Synthetic colour blocks, not a photograph from an actual inspection.
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}
function syntheticPng(): Buffer {
  const width = 640, height = 400, header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (1 + width * 3) + 1 + x * 3;
    const band = Math.floor(x / 160) + Math.floor(y / 100);
    rows[offset] = band % 2 ? 27 : 224; rows[offset + 1] = band % 2 ? 94 : 242; rows[offset + 2] = band % 2 ? 60 : 230;
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
try {
  const [admin, generator] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
  ]);
  assert.equal(admin.activo, true); assert.equal(admin.rol, 'ADMIN');
  assert.match(generator.generador.razonSocial, /^QA /);
  const suffix = randomUUID().slice(0, 8);
  const inspection = await db.inspeccion.create({ data: {
    numero: `QA-EVIDENCIA-${suffix}`, tipoActor: 'GENERADOR', generadorId: generator.generador.id,
    inspectorId: admin.id, estado: 'EN_REVISION', observaciones: 'Inspección artificial para probar navegación de evidencia.',
  }, select: { id: true, numero: true } });
  const content = syntheticPng();
  const storageKey = `inspecciones/${inspection.id}/qa-foto.png`;
  const target = path.join(process.env.UPLOADS_DIR!, storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, content, { flag: 'wx', mode: 0o600 });
  const evidence = await db.evidenciaInspeccion.create({ data: {
    inspeccionId: inspection.id, tipo: 'FOTO', nombreOriginal: 'qa-foto.png', storageKey,
    mimeDetectado: 'image/png', bytes: content.length, sha256: createHash('sha256').update(content).digest('hex'),
    descripcion: 'Imagen artificial de revisión', creadoPorId: admin.id,
  }, select: { id: true } });
  await writeFile(path.join(out, 'fixture.json'), JSON.stringify({ synthetic: true, inspection, evidence, users: { admin: admin.id } }), { mode: 0o600 });
  console.log('Expediente y fotografía artificiales preparados.');
} finally { await db.$disconnect(); }
