import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-rollback-partial-20261030');
assert.equal(process.env.QA_COMPAT_BACKEND || 'current', 'current');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'rollback-fixture.json'), 'utf8'));
assert.equal(fixture.synthetic, true);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api';
try {
  const tokens = new Map<string, string>();
  const users = new Map<string, string>();
  for (const [index, role] of ['generador', 'transportista', 'operador'].entries()) {
    const user = await db.usuario.findUniqueOrThrow({ where: { email: `${role}@night-qa.invalid` } });
    users.set(role, user.id);
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json',
      Cookie: `sitrep_qa_client=127.11.72.${index + 1}` }, body: JSON.stringify({ email: `${role}@night-qa.invalid`, password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(response.status, 200); tokens.set(role, (await response.json() as any).data.tokens.accessToken);
  }
  let accesses = 0;
  for (const item of Object.values(fixture.cases) as Array<{ id: string; numero: string; markerSha256: string }>) {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.deepEqual(manifest, { numero: item.numero, isDemoData: true, estado: 'RECIBIDO' });
    const events = await db.eventoManifiesto.findMany({ where: { manifiestoId: item.id } });
    const marker = events.find((event: any) => event.tipo === 'PROPUESTA_PARTES_V1');
    assert.ok(marker); assert.equal(createHash('sha256').update(marker.descripcion).digest('hex'), item.markerSha256);
    for (const type of ['FIRMA', 'APROBACION_TRANSPORTISTA', 'APROBACION_OPERADOR'])
      assert.equal(events.filter((event: any) => event.tipo === type).length, 1);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: item.id } }), 0);
    assert.equal(await db.tramoTransporte.count({ where: { manifiestoId: item.id } }), 0);
    for (const [role, token] of tokens) {
      const response = await fetch(base + `/manifiestos/${item.id}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as any).data.manifiesto.estado, 'RECIBIDO');
      assert.equal(await db.notificacion.count({ where: { manifiestoId: item.id, usuarioId: users.get(role),
        titulo: 'Coordinación iniciada: tratamiento en origen' } }), 1);
      accesses++;
    }
  }
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  const proof = { synthetic: true, backend: 'bcf8861f', cases: 2, authorizedAccesses: accesses,
    markerPreserved: true, approvalsEach: 3, noTripOrGps: true, emailAttempts: 0, emailSent: 0, push: false };
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'rollback-forward-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await db.$disconnect(); }
