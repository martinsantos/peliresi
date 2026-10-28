import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const fixture = JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!, 'gps-observation-private.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api';
try {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.43.21.12' },
    body: JSON.stringify({ email: 'admin@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(login.status, 200);
  const session: any = await login.json();
  assert.notEqual(session.data.user.training, true);
  const token = session.data.tokens.accessToken;
  for (const item of Object.values(fixture.cases) as Array<{ id: string; numero: string; ruleName: string }>) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true } });
    assert.equal(trip.numero, item.numero); assert.equal(trip.isDemoData, true);
    const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(`${base}/anomalias/detectar/${item.id}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })));
    assert.ok(responses.every(response => response.status === 200));
    let direct: any[] = [], configured: any[] = [];
    for (let attempt = 0; attempt < 60; attempt++) {
      direct = await db.notificacion.findMany({ where: { usuarioId: fixture.receiverId, manifiestoId: item.id, tipo: 'ANOMALIA_DETECTADA', titulo: { startsWith: 'GPS:' } } });
      configured = await db.notificacion.findMany({ where: { usuarioId: fixture.generatorId, manifiestoId: item.id, titulo: item.ruleName } });
      if (direct.length >= 3 && configured.length >= 1) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const anomalies = await db.anomaliaTransporte.findMany({ where: { manifiestoId: item.id }, orderBy: { tipo: 'asc' } });
    assert.deepEqual(anomalies.map((row: any) => row.tipo).sort(), ['GPS_PERDIDO', 'PARADA_PROLONGADA', 'VELOCIDAD_ANORMAL']);
    assert.equal(direct.length, 3); assert.equal(new Set(direct.map((row: any) => row.titulo)).size, 3);
    assert.equal(configured.length, 1);
    for (const row of [...anomalies, ...direct, ...configured]) {
      assert.match(row.descripcion ?? row.mensaje, /hora de captura no disponible/i);
      assert.match(row.descripcion ?? row.mensaje, /verificá el caso con transporte/i);
    }
  }
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'gps-observation-http-proof.json'), JSON.stringify({ synthetic: true,
    production: false, cases: 2, simultaneousAnalysesPerCase: 4, directClassesPerCase: 3, configuredNoticesPerCase: 1,
    emailAttempts: 0, emailsSent: 0, push: false, capClosed: true }, null, 2));
  console.log('Análisis y avisos sintéticos verificados en la API de preview.');
} finally { await db.$disconnect(); }
