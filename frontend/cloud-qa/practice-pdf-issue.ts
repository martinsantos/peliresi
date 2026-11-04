/** Issue new certificates only for verified synthetic in-situ cases in the isolated preview. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-practice-pdf-20261101';
const prior = '/work/sitrep/.qa-operational-ui-current2026110105';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'practice-pdf-cb4edebc');
assert.equal(process.env.GITHUB_SHA, 'cb4edebc35214f4b84524237b0ea42ff7e58b0aa');
assert.equal(process.env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const proofDir = path.join(prior, 'proposal-e2e-initial');
const proofs = readdirSync(proofDir, { withFileTypes: true }).filter(entry => entry.isDirectory())
  .map(entry => path.join(proofDir, entry.name, 'proof.json')).filter(existsSync)
  .map(file => JSON.parse(readFileSync(file, 'utf8')))
  .filter(proof => proof.creator === 'generador' && proof.noTripOrGps === true);
assert.deepEqual(proofs.map(proof => proof.surface).sort(), ['app', 'web-desktop']);
const credentials = JSON.parse(readFileSync(path.join(prior, 'handoff-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client');
const sharp = backendRequire('sharp');
const signature = 'data:image/png;base64,' + (await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
const db = new PrismaClient();
const tokens = new Map<string, string>();
const roles = ['generador', 'transportista', 'operador'] as const;
const notice = 'DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL';
const results: Array<Record<string, unknown>> = [];
async function token(role: string) {
  if (!tokens.has(role)) {
    const response = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `sitrep_qa_client=127.11.71.${roles.indexOf(role as typeof roles[number]) + 1}` },
      body: JSON.stringify({ email: role + '@night-qa.invalid', password: credentials.password }) });
    assert.equal(response.status, 200); tokens.set(role, (await response.json()).data.tokens.accessToken);
  }
  return tokens.get(role)!;
}
async function api(role: string, route: string, method = 'GET', body?: unknown, status = 200) {
  const response = await fetch('http://127.0.0.1:4177/api' + route, { method,
    headers: { Authorization: 'Bearer ' + await token(role), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal(response.status, status, `${method} ${route}`);
  return (await response.json()).data;
}
try {
  for (const proof of proofs) {
    const m = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id },
      include: { generador: true, transportista: true, operador: true, residuos: { include: { tipoResiduo: true } } } });
    assert.equal(m.isDemoData, true); assert.equal(m.numero, proof.numero); assert.equal(m.modalidad, 'IN_SITU');
    assert.equal(m.estado, 'RECIBIDO'); assert.equal(m.fechaRetiro, null); assert.ok(m.transportista);
    for (const actor of [m.generador, m.transportista, m.operador]) assert.match(actor.razonSocial, /^QA /);
    assert.equal(m.residuos.length, 1); assert.equal(m.residuos[0].tipoResiduo.codigo, 'Y1');
    const residue = m.residuos[0], quantity = Number(residue.cantidad);
    const permitted = await db.tratamientoAutorizado.findFirst({ where: { operadorId: m.operadorId, activo: true } });
    const method = permitted?.metodo || 'QA tratamiento artificial';
    await api('operador', `/manifiestos/${m.id}/pesaje`, 'POST', { residuos: [{ id: residue.id, cantidadRecibida: quantity }] });
    await api('operador', `/manifiestos/${m.id}/tratamiento`, 'POST', { metodo: method });
    const partial = await api('operador', `/manifiestos/${m.id}/certificados`, 'POST',
      { id: randomUUID(), tipo: 'PARCIAL', firma: signature, metodo: method, cantidades: [{ residuoId: residue.id, cantidad: Math.min(4, quantity) }] }, 201);
    await api('operador', `/manifiestos/${m.id}/cerrar`, 'POST', {});
    const final = await api('operador', `/manifiestos/${m.id}/certificados`, 'POST',
      { id: randomUUID(), tipo: 'FINAL', firma: signature, metodo: method, cantidades: [{ residuoId: residue.id, cantidad: quantity }] }, 201);
    const recipients: Record<string, string> = {};
    for (const role of roles) {
      const list = await api(role, `/manifiestos/${m.id}/certificados`);
      assert.ok(list.some((item: { id: string }) => item.id === partial.id));
      assert.ok(list.some((item: { id: string }) => item.id === final.id));
      const response = await fetch(`http://127.0.0.1:4177/api/manifiestos/${m.id}/certificados/${final.id}/archivo`,
        { headers: { Authorization: 'Bearer ' + await token(role) } });
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer()), digest = createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest, final.pdfSha256); recipients[role] = digest;
      if (role === 'operador') {
        const file = path.join(out, `nuevo-certificado-${proof.surface}.pdf`);
        writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
        const pages = execFileSync('pdftotext', ['-raw', file, '-'], { encoding: 'utf8' }).split('\f').filter(page => page.trim());
        assert.ok(pages.length > 0); for (const page of pages) assert.ok(page.includes(notice));
      }
    }
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: m.id } }), 0);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: m.id } }), 0);
    results.push({ surface: proof.surface, id: m.id, numero: m.numero, partialId: partial.id, finalId: final.id, finalSha256: final.pdfSha256, recipients });
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  writeFileSync(path.join(out, 'new-certificates.json'), JSON.stringify({ synthetic: true, results }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`${results.length} new synthetic partial/final certificates issued and read by the three parties.`);
} finally { await db.$disconnect(); }
