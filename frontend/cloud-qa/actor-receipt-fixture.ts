/** Upload a synthetic receipt to three owned actor records through the real API. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { qaBackendEntry } from './rollback-backend.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-actor-receipt-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.UPLOADS_DIR, '/work/sitrep/.qa-operational-ui-current2026103070/uploads');
assert.equal(process.env.TRAINING_DATABASE_URL, ''); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const previous = JSON.parse(readFileSync('/work/sitrep/.qa-receipt-document-20261030/fixture-after.json', 'utf8'));
assert.equal(previous.synthetic, true); assert.match(previous.owner, /@night-qa\.invalid$/);
const onboarding = JSON.parse(readFileSync('/work/sitrep/.qa-operational-ui-current2026103070/onboarding-ux-fixture.json', 'utf8'));
const other = onboarding.cases.find((item: any) => item.type === 'OPERADOR' && item.email !== previous.owner);
assert.ok(other); assert.match(other.email, /^onboarding-ux-[a-f0-9]+-\d+@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const owner = await db.usuario.findUniqueOrThrow({ where: { email: previous.owner } });
  const outsider = await db.usuario.findUniqueOrThrow({ where: { email: other.email } });
  assert.notEqual(owner.id, outsider.id); assert.equal(outsider.activo, true); assert.equal(outsider.emailVerified, true);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  assert.equal(admin.rol, 'ADMIN'); assert.equal(admin.activo, true);
  const actors: Record<string, any> = {};
  for (const type of ['generador', 'transportista', 'operador']) {
    const rows = await db[type].findMany({ where: { usuarioId: owner.id, activo: true }, select: { id: true, usuarioId: true } });
    assert.equal(rows.length, 1); actors[type] = rows[0];
  }
  const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.25.80.1' },
    body: JSON.stringify({ email: admin.email, password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(response.status, 200); const token = (await response.json()).data.tokens.accessToken;
  const { jsPDF } = createRequire(path.join(root, 'frontend/package.json'))('jspdf');
  const pdf = new jsPDF(); const run = randomUUID();
  pdf.text(['COMPROBANTE ARTIFICIAL - SIN VALIDEZ', 'Referencia QA: ' + run, 'No acredita un pago.'], 15, 25);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  const created: Record<string, any> = {};
  for (const step of ['generador-base', 'transportista', 'generador', 'operador']) {
    const type = step === 'generador-base' ? 'generador' : step;
    const form = new FormData(); form.set('tipo', 'COMPROBANTE_PAGO');
    form.set('archivo', new Blob([bytes], { type: 'application/pdf' }), `QA-${type}-${run}.pdf`);
    const url = `http://127.0.0.1:4177/api/actores/${type === 'generador' ? 'generadores' : type === 'operador' ? 'operadores' : 'transportistas'}/${actors[type].id}/documentos`;
    const uploaded = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
    assert.equal(uploaded.status, 201); const document = (await uploaded.json()).data.documento;
    assert.equal(document.analisis.duplicado, step !== 'generador-base');
    created[step] = { actorId: actors[type].id, document: document.id, documentName: document.nombre };
    if (step !== 'generador-base') {
      const notices = await db.notificacion.findMany({ where: { usuarioId: owner.id, titulo: 'Comprobante repetido' }, orderBy: { createdAt: 'desc' } });
      const notice = notices.find((n: any) => { try { return JSON.parse(n.datos).documentoId === document.id; } catch { return false; } });
      assert.ok(notice); const data = JSON.parse(notice.datos);
      assert.equal(data.actorTipo, type); assert.equal(data.actorId, actors[type].id);
      const { notificationMailContent } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'services/notification-mail.service.js'));
      const mail = notificationMailContent({ ...notice, email: owner.email, activo: true, emailVerified: true, notifEmail: true, rol: 'GENERADOR' });
      assert.ok(mail?.html); created[step].notice = notice.id; created[step].mailHtml = mail.html;
    }
  }
  writeFileSync(path.join(out, 'fixture.json'), JSON.stringify({ synthetic: true, owner: owner.email, outsider: outsider.email, created }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Cuatro cargas artificiales; tres avisos de duplicado creados por la API real.');
} finally { await db.$disconnect(); }
