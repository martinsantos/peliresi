import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'inspection_intake_20261020');
const { PrismaClient, Prisma } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const row = await db.adendaManifiesto.findFirstOrThrow({ where: { informeHallazgo: { not: Prisma.DbNull }, version: { gt: 0 } }, orderBy: { createdAt: 'asc' } });
  const login = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'operator@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) }); assert.equal(login.status, 200);
  const token = (await login.json()).data.tokens.accessToken;
  async function download(version: number) {
    const response = await fetch(`http://127.0.0.1:3037/api/manifiestos/${row.manifiestoId}/adendas/${row.id}/anexo?version=${version}`, { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('content-type')!, /application\/pdf/);
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    const text = execFileSync('pdftotext', ['-', '-'], { input: bytes, encoding: 'utf8' }).replace(/\s+/g, ' ');
    assert.match(text, /INFORME DE HALLAZGO DEL OPERADOR/); assert.match(text, /Y21/); assert.match(text, /Cantidad diferente/);
    writeFileSync(process.env.QA_ARTIFACTS + `/finding-annex-v${version}.pdf`, bytes);
    return { text, hash: response.headers.get('x-sitrep-content-sha256') };
  }
  const historical = await download(0), current = await download(row.version), repeated = await download(0);
  assert.match(historical.text, /PENDIENTE DE REVISIÓN/); assert.match(current.text, /APROBADA POST FACTO/);
  assert.equal(historical.hash, repeated.hash); assert.notEqual(historical.hash, current.hash);
  assert.match(historical.hash!, /^[a-f0-9]{64}$/);
  writeFileSync(process.env.QA_ARTIFACTS + '/document.json', JSON.stringify({ passed: 3, checks: ['actual PDF includes finding and quantity/stream evidence', 'historical and current decisions distinct', 'historical structured-content hash repeatable; private no-store'], adendaId: row.id, production: false }, null, 2));
  console.log('Finding annex: 3 groups PASS with native PDF extraction.');
} finally { await db.$disconnect(); }
