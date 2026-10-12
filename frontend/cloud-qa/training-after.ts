import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.TRAINING_DATABASE_URL, 'postgresql://sitrep_training_role@127.0.0.1:55440/sitrep_night_qa_20260926?schema=sitrep_training');
const { PrismaClient } = backendRequire('@prisma/client');
const operational = new PrismaClient();
const school = new PrismaClient({ datasources: { db: { url: process.env.TRAINING_DATABASE_URL } } });
try {
  assert.equal(await operational.usuario.count({ where: { email: { endsWith: '@capacitacion.invalid' } } }), 0);
  assert.equal(await operational.manifiesto.count({ where: { numero: { startsWith: 'CAP-' } } }), 0);
  assert.equal(await operational.ticketSoporte.count({ where: { asunto: { startsWith: 'CAP consulta de práctica' } } }), 0);
  assert.equal(await school.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0);
  const files = await school.adjuntoSoporte.findMany({ where: { nombre: 'cap-practica.png' } });
  assert.equal(files.length, 3, 'One real multipart upload in each browser project');
  for (const file of files) {
    assert.match(file.storageKey, /^soporte\/[a-f0-9-]{36}\.png$/);
    const actual = path.join(process.env.UPLOADS_DIR!, 'capacitacion', file.storageKey);
    assert.equal(createHash('sha256').update(readFileSync(actual)).digest('hex'), file.sha256);
    assert.equal(existsSync(path.join(process.env.UPLOADS_DIR!, file.storageKey)), false);
  }
  writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'training-after.json'), JSON.stringify({
    passed: true, operationalRecordsMixed: 0, deliverableTrainingMail: 0, isolatedAttachments: files.length,
    productionConnected: false,
  }, null, 2));
} finally { await school.$disconnect(); await operational.$disconnect(); }
