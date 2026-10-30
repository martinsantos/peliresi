/** Cross-account checks against the loopback synthetic preview only. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-receipt-document-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const fixture = JSON.parse(readFileSync(path.join(out, 'fixture-after.json'), 'utf8'));
const onboarding = JSON.parse(readFileSync('/work/sitrep/.qa-operational-ui-current2026103070/onboarding-ux-fixture.json', 'utf8'));
assert.equal(fixture.synthetic, true); assert.match(fixture.owner, /@night-qa\.invalid$/);
const other = onboarding.cases.find((item: any) => item.type === 'OPERADOR' && item.email !== fixture.owner);
assert.ok(other); assert.match(other.email, /^onboarding-ux-[a-f0-9]+-\d+@night-qa\.invalid$/);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const owner = await db.usuario.findUniqueOrThrow({ where: { email: fixture.owner } });
  const outsider = await db.usuario.findUniqueOrThrow({ where: { email: other.email } });
  assert.notEqual(owner.id, outsider.id); assert.equal(outsider.activo, true); assert.equal(outsider.emailVerified, true);
  const admin = await db.usuario.create({ data: { email: 'receipt-access-' + randomUUID() + '@night-qa.invalid', nombre: 'QA permiso de transporte',
    password: await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!', 8), rol: 'ADMIN_TRANSPORTISTA', activo: true, emailVerified: true, notifEmail: false } });
  const application = await db.solicitudInscripcion.findUniqueOrThrow({ where: { id: fixture.operator } });
  const document = await db.documentoSolicitud.findUniqueOrThrow({ where: { id: fixture.document } });
  assert.equal(application.usuarioId, owner.id); assert.equal(document.solicitudId, application.id);
  const base = 'http://127.0.0.1:4177/api';
  const token = async (email: string, index: number) => {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.24.52.${index}` },
      body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(response.status, 200); return (await response.json()).data.tokens.accessToken as string;
  };
  const ownerToken = await token(owner.email, 1), outsiderToken = await token(outsider.email, 2), adminToken = await token(admin.email, 3);
  const read = (token: string, url: string) => fetch(base + url, { headers: { Authorization: 'Bearer ' + token } });
  const own = await read(ownerToken, '/solicitudes/' + application.id);
  assert.equal(own.status, 200);
  assert.ok((await own.json()).data.solicitud.documentos.some((item: any) => item.id === document.id));
  for (const credential of [outsiderToken, adminToken]) {
    const detail = await read(credential, '/solicitudes/' + application.id);
    const download = await read(credential, '/solicitudes/' + application.id + '/documentos/' + document.id + '/download');
    assert.equal(detail.status, 403); assert.equal(download.status, 403);
  }
  const report = { synthetic: true, ownerDetail: 200, otherOperatorDetail: 403, otherOperatorDownload: 403,
    wrongAdminDetail: 403, wrongAdminDownload: 403 };
  writeFileSync(path.join(out, 'access.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await db.$disconnect(); }
