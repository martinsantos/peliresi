/** Synthetic-only: create two annual certificates and check their owned notices. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-product-ux-20261023/multirol-draft-20261024/multirol-fixture.json', 'utf8'));
assert.equal(fixture.email, 'draft-multirole-20261024@night-qa.invalid');
const file = process.env.QA_ARTIFACTS + '/environmental-certificate-context.json';
const base = 'http://127.0.0.1:3037/api';
const password = 'OnlyLocal-NightQA-2026!';
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
function syntheticPdf(label: string): Buffer {
  const stream = 'BT /F1 16 Tf 50 740 Td (CERTIFICADO QA ' + label.toUpperCase() + ' - SIN VALIDEZ OFICIAL) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(pdf);
}
async function request(route: string, opts: { token?: string; role?: string; body?: unknown; status?: number } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  if (opts.role) headers['X-SITREP-Activity'] = opts.role;
  const form = opts.body instanceof FormData;
  if (opts.body && !form) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method: opts.body ? 'POST' : 'GET', headers,
    ...(opts.body ? { body: form ? opts.body as FormData : JSON.stringify(opts.body) } : {}),
  });
  assert.equal(response.status, opts.status || 200, route + ' returned ' + response.status);
  if ((opts.status || 200) >= 400) return null;
  if (route.includes('/download')) return Buffer.from(await response.arrayBuffer());
  return (await response.json()).data;
}
async function login(email: string) {
  assert.ok(email.endsWith('@night-qa.invalid'));
  return (await request('/auth/login', { body: { email, password } })).tokens.accessToken as string;
}
try {
  const user = await db.usuario.findUniqueOrThrow({ where: { id: fixture.userId } });
  assert.equal(user.email, fixture.email);
  const operator = await db.operador.findUniqueOrThrow({ where: { id: fixture.actors.OPERADOR } });
  assert.equal(operator.usuarioId, user.id);
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } });
  assert.equal(admin.rol, 'ADMIN');
  const before = { manifests: await db.manifiesto.count(), attempts: await db.emailQueue.count({ where: { intentos: { gt: 0 } } }),
    sent: await db.emailQueue.count({ where: { sentAt: { not: null } } }) };
  assert.equal(before.attempts, 0); assert.equal(before.sent, 0);
  let recorded: any;
  if (!existsSync(file)) {
    assert.notEqual(process.env.QA_CAA_VERIFY, 'true');
    const token = await login(admin.email), items = [];
    for (const suffix of ['primera', 'segunda']) {
      const name = 'qa-caa-multirol-' + suffix + '-20261027.pdf';
      const matches = await db.documento.findMany({ where: { operadorId: operator.id, tipo: 'CERTIFICADO_AMBIENTAL', nombre: name } });
      assert.ok(matches.length <= 1, 'No duplicate synthetic certificate');
      const bytes = syntheticPdf(suffix);
      let document = matches[0];
      if (!document) {
        const form = new FormData();
        form.set('tipo', 'CERTIFICADO_AMBIENTAL'); form.set('anio', '2026');
        form.set('archivo', new Blob([bytes], { type: 'application/pdf' }), name);
        document = (await request('/actores/operadores/' + operator.id + '/documentos', { token, body: form, status: 201 })).documento;
      }
      const notices = await db.notificacion.findMany({ where: { usuarioId: user.id, datos: { contains: document.id } } });
      const own = notices.filter((notice: any) => JSON.parse(notice.datos).tipo === 'certificado_ambiental');
      assert.equal(own.length, 1);
      assert.equal(JSON.parse(own[0].datos).actorId, operator.id);
      items.push({ documentId: document.id, noticeId: own[0].id, sha256: hash(bytes), name });
    }
    recorded = { userId: user.id, email: fixture.email, operatorId: operator.id, items, before };
    writeFileSync(file, JSON.stringify(recorded, null, 2));
  } else recorded = JSON.parse(readFileSync(file, 'utf8'));
  const owner = await login(fixture.email), other = await login('generador2@night-qa.invalid');
  for (const item of recorded.items) {
    const notice = await request('/notificaciones/' + item.noticeId, { token: owner, role: 'GENERADOR' });
    assert.equal(JSON.parse(notice.datos).actorId, operator.id);
    assert.equal(JSON.parse(notice.datos).documentoId, item.documentId);
    await request('/notificaciones/' + item.noticeId, { token: other, status: 404 });
    await request('/actores/operadores/' + operator.id + '/documentos', { token: owner, role: 'GENERADOR', status: 403 });
    const documents = await request('/actores/operadores/' + operator.id + '/documentos', { token: owner, role: 'OPERADOR' });
    assert.ok(documents.documentos.some((entry: any) => entry.id === item.documentId));
    const pdf = await request('/actores/documentos/' + item.documentId + '/download', { token: owner, role: 'OPERADOR' });
    assert.equal(hash(pdf), item.sha256);
    await request('/actores/documentos/' + item.documentId + '/download', { token: other, status: 403 });
  }
  assert.equal(await db.manifiesto.count(), recorded.before.manifests);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  console.log(JSON.stringify({ documents: recorded.items.length, sameOwner: true, otherAccountDenied: true, wrongRoleDenied: true, originalBytes: true, emailAttempts: 0, emailSent: 0 }));
} finally { await db.$disconnect(); }
