/** Verify the same synthetic certificate and notices for its three parties, with external delivery off. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api', id = 'cmvqqdy3y00ncsts65zv1hnj4';
const certId = '3183c3dc-58ad-4942-818f-737fc97cef75';
const accounts = { operador: 'operador@night-qa.invalid',
  generador: 'onboarding-ux-9e08a0c0-1@night-qa.invalid', transporte: 'onboarding-ux-9e08a0c0-3@night-qa.invalid' };
try {
  const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id }, include: { residuos: { include: { tipoResiduo: true } } } });
  assert.equal(manifest.isDemoData, true); assert.equal(manifest.numero, '2026-000159');
  assert.deepEqual(manifest.residuos.map((r: any) => [r.tipoResiduo.codigo, r.cantidad, r.cantidadRecibida]), [['Y8', 10, 12]]);
  const cert = await db.certificadoManifiesto.findUniqueOrThrow({ where: { id: certId } });
  assert.equal(cert.manifiestoId, id); assert.equal(cert.tipo, 'FINAL');
  const document = cert.documento as any;
  assert.deepEqual(document.cantidades.map((r: any) => [r.corriente, r.cantidad, r.unidad]), [['Y8', 12, 'kg'], ['Y12', 1, 'kg']]);
  assert.equal(document.cantidades[1].origen, 'HALLAZGO');
  assert.deepEqual(document.cantidades[1].adendas, [{ id: '682bd6d3-ee8f-44b9-9ec6-63e722be1696', version: 1 }]);
  const original = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: '232b7c4b-dd5a-4236-a12c-f62c8a53ef88' } });
  const correction = await db.adendaManifiesto.findUniqueOrThrow({ where: { id: '682bd6d3-ee8f-44b9-9ec6-63e722be1696' } });
  assert.equal((original.revisiones as any[]).at(-1).decision, 'OBSERVADA');
  assert.equal((correction.revisiones as any[]).at(-1).decision, 'APROBADA');
  const digests: string[] = [], path = process.env.QA_ARTIFACTS! + '/certificate-findings-final.pdf';
  for (const [role, email] of Object.entries(accounts)) {
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.42.21.' + (digests.length + 1) },
      body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(login.status, 200, role);
    const data: any = await login.json();
    const response = await fetch(base + '/manifiestos/' + id + '/certificados/' + certId + '/archivo', { headers: { Authorization: 'Bearer ' + data.data.tokens.accessToken } });
    assert.equal(response.status, 200, role);
    assert.match(response.headers.get('content-type') || '', /^application\/pdf/);
    const bytes = Buffer.from(await response.arrayBuffer()), digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, cert.pdfSha256); assert.equal(response.headers.get('x-document-sha256'), digest);
    if (!digests.length) writeFileSync(path, bytes);
    digests.push(digest);
    if (role !== 'operador') {
      const user = await db.usuario.findUniqueOrThrow({ where: { email }, select: { id: true } });
      assert.ok(await db.notificacion.count({ where: { manifiestoId: id, usuarioId: user.id, datos: { contains: certId } } }) > 0);
    }
  }
  assert.equal(new Set(digests).size, 1);
  const pdfText = execFileSync('pdftotext', ['-raw', path, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  assert.match(pdfText, /Y8\s+12\s+kg/); assert.match(pdfText, /Y12\s+1\s+kg/);
  assert.match(pdfText, /SIN VALIDEZ OFICIAL/);
  const result = { at: new Date().toISOString(), manifest: manifest.numero, certificate: cert.numero, pdfSha256: cert.pdfSha256,
    checks: ['las tres cuentas descargan el mismo PDF', 'Y8 12 kg y Y12 1 kg figuran en el PDF', 'aviso para generador y transporte',
      'declaración original y antecedente observado conservados', 'datos artificiales sin validez oficial'] };
  writeFileSync(process.env.QA_ARTIFACTS! + '/certificate-findings-receipts.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
