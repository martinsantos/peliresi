import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!, file = out + '/legacy-field-fixture.json';
const email = 'legacy-field-20261025@night-qa.invalid', id = 'qa-legacy-field-20261025';
try {
  if (!existsSync(file)) {
    assert.notEqual(process.env.QA_LEGACY_FIELD_VERIFY, 'true');
    const password = await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!', 8);
    const fixture = await db.$transaction(async (tx: any) => {
      assert.equal(await tx.usuario.count({ where: { email } }), 0, 'Never replace an existing account');
      const user = await tx.usuario.create({ data: { email, password, nombre: 'QA Recuperación anterior', rol: 'GENERADOR', esInspector: true, activo: true, emailVerified: true, notifEmail: false } });
      const common = { usuarioId: user.id, razonSocial: 'QA Campo · datos artificiales', cuit: '99-QA-LEGACY-FIELD-20261025', domicilio: 'QA sin domicilio real', telefono: 'QA sin teléfono', email, categoria: 'QA', activo: true };
      const generator = await tx.generador.create({ data: { ...common, numeroInscripcion: 'QA-no-oficial' } });
      const operator = await tx.operador.create({ data: { ...common, numeroHabilitacion: 'QA-no-oficial' } });
      await tx.solicitudInscripcion.create({ data: { usuarioId: user.id, tipoActor: 'OPERADOR', estado: 'APROBADA', datosActor: '{}', operadorId: operator.id } });
      await tx.inspeccion.create({ data: { id, numero: 'QA-ANTERIOR-20261025', inspectorId: user.id, estado: 'EN_CAMPO', observaciones: 'QA · registro inicial confirmado.', datosActa: {}, informeTecnico: {} } });
      return { email, userId: user.id, id, actors: { GENERADOR: generator.id, OPERADOR: operator.id }, manifests: await tx.manifiesto.count() };
    });
    writeFileSync(file, JSON.stringify(fixture, null, 2));
  }
  const fixture = JSON.parse(readFileSync(file, 'utf8'));
  const response = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200);
  const token = (await response.json()).data.tokens.accessToken, checks = [];
  for (const role of ['GENERADOR', 'OPERADOR']) {
    const headers = { Authorization: 'Bearer ' + token, 'X-SITREP-Activity': role };
    const profile = await fetch('http://127.0.0.1:3037/api/auth/profile', { headers });
    const user = (await profile.json()).data.user;
    assert.equal(user.id, fixture.userId); assert.equal(user.rol, role); assert.equal(user.esInspector, true);
    const inspected = await fetch('http://127.0.0.1:3037/api/inspecciones/' + id, { headers });
    assert.equal(inspected.status, 200, role + ' must be an explicitly assigned inspector');
    checks.push({ role, status: inspected.status });
  }
  const inspection = await db.inspeccion.findUniqueOrThrow({ where: { id }, include: { evidencias: true } });
  if (process.env.QA_LEGACY_FIELD_VERIFY === 'true') {
    assert.equal(inspection.version, 3);
    assert.equal(inspection.datosActa.requerimientos, 'QA · medida nueva de esta actividad.');
    assert.equal(inspection.observaciones, 'QA · texto recuperado de versión anterior.');
    assert.equal(inspection.evidencias.length, 1, 'Only the active context capture was published');
    assert.equal(inspection.evidencias[0].nombreOriginal, 'campo-anterior.pdf');
    assert.equal(inspection.evidencias[0].creadoPorId, fixture.userId);
    const bytes = readFileSync(process.env.UPLOADS_DIR + '/' + inspection.evidencias[0].storageKey);
    assert.equal(bytes.length, inspection.evidencias[0].bytes);
    assert.equal(bytes.toString(), '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% QA field anterior\n%%EOF\n');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), inspection.evidencias[0].sha256);
  }
  assert.equal(await db.manifiesto.count(), fixture.manifests);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(out + '/legacy-field-http.json', JSON.stringify({ at: new Date().toISOString(), checks, inspection: { id, version: inspection.version, observaciones: inspection.observaciones, evidence: inspection.evidencias.map((entry: any) => ({ id: entry.id, nombre: entry.nombreOriginal, bytes: entry.bytes, sha256: entry.sha256 })) }, manifests: fixture.manifests, emailAttempts: 0, emailSent: 0 }, null, 2));
  console.log('Synthetic assigned inspector: both activities authorized; no manifest or external delivery changes.');
} finally { await db.$disconnect(); }
