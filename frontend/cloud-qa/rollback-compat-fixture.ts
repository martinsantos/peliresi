import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-rollback-partial-20261030');
assert.equal(process.env.QA_COMPAT_BACKEND || 'current', 'current');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api';
async function request(url: string, token?: string, body?: unknown, expected = 200) {
  const response = await fetch(base + url, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json',
      Cookie: 'sitrep_qa_client=127.11.71.15' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const json = await response.json() as any;
  assert.equal(response.status, expected, `${url}: ${json.message || 'respuesta inesperada'}`);
  return json.data;
}
try {
  const users = await Promise.all(['generador', 'transportista', 'operador'].map(role =>
    db.usuario.findUniqueOrThrow({ where: { email: `${role}@night-qa.invalid` },
      include: { generador: true, transportista: true, operador: true } })));
  for (const [index, role] of ['generador', 'transportista', 'operador'].entries()) {
    assert.equal(users[index].activo, true); assert.match(users[index][role].razonSocial, /^QA /);
  }
  const [generator, carrier, operator] = users;
  const waste = await db.tipoResiduo.findFirstOrThrow({ where: { codigo: 'Y1' } });
  const login = await request('/auth/login', undefined, { email: 'generador@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' });
  const token = login.tokens.accessToken as string;
  const sharp = backendRequire('sharp');
  const signature = 'data:image/png;base64,' + (await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
  const cases: Record<string, { id: string; numero: string; markerSha256: string }> = {};
  for (const surface of ['web-desktop', 'app']) {
    const response = await request('/manifiestos', token, { generadorId: generator.generador.id,
      transportistaId: carrier.transportista.id, operadorId: operator.operador.id, modalidad: 'IN_SITU',
      fechaEstimadaRetiro: '2099-12-25', observaciones: `QA reversión parcial ${surface}`,
      residuos: [{ tipoResiduoId: waste.id, cantidad: 11, unidad: 'kg' }] }, 201);
    const manifest = response.manifiesto;
    assert.equal(manifest.estado, 'PENDIENTE_APROBACION');
    assert.equal(manifest.generadorId, generator.generador.id);
    assert.equal(manifest.transportistaId, carrier.transportista.id);
    assert.equal(manifest.operadorId, operator.operador.id);
    await db.manifiesto.update({ where: { id: manifest.id }, data: { isDemoData: true } });
    await request(`/manifiestos/${manifest.id}/firmar`, token, { firma: signature });
    const approvals = await request(`/manifiestos/${manifest.id}/aprobaciones`, token);
    assert.equal(approvals.partes.length, 3);
    assert.equal(approvals.partes.filter((part: any) => part.aprobada).length, 1);
    const marker = await db.eventoManifiesto.findFirstOrThrow({ where: { manifiestoId: manifest.id, tipo: 'PROPUESTA_PARTES_V1' } });
    assert.equal(JSON.parse(marker.descripcion).version, 2);
    cases[surface] = { id: manifest.id, numero: manifest.numero,
      markerSha256: createHash('sha256').update(marker.descripcion).digest('hex') };
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'rollback-fixture.json'), JSON.stringify({ synthetic: true, cases }, null, 2), { mode: 0o600 });
  console.log('Dos propuestas artificiales en origen preparadas con una de tres aprobaciones.');
} finally { await db.$disconnect(); }
