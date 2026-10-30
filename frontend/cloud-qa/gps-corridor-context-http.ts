import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const out = process.env.QA_ARTIFACTS!, fixture = JSON.parse(await readFile(path.join(out, 'gps-corridor-context-fixture.json'), 'utf8'));
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api';
try {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.44.22.11' },
    body: JSON.stringify({ email: 'transportista@night-qa.invalid', password: 'OnlyLocal-NightQA-2026!' }) });
  assert.equal(login.status, 200);
  const session: any = await login.json(); assert.notEqual(session.data.user.training, true);
  const token = session.data.tokens.accessToken, checks = [];
  for (const item of Object.values(fixture.cases) as Array<any>) {
    const trip = await db.manifiesto.findUniqueOrThrow({ where: { id: item.id }, select: { numero: true, isDemoData: true, estado: true } });
    assert.equal(trip.numero, item.numero); assert.equal(trip.isDemoData, true); assert.equal(trip.estado, 'EN_TRANSITO');
    for (const offset of [0, 0.01, 0.02]) {
      const result = await fetch(`${base}/manifiestos/${item.id}/ubicacion-idempotente`, { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ puntoId: randomUUID(), latitud: -30 - offset, longitud: -66 - offset }) });
      assert.equal(result.status, 200);
    }
    let direct: any = null, configured: any = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      direct = await db.notificacion.findFirst({ where: { usuarioId: fixture.receiverId, manifiestoId: item.id,
        tipo: 'ANOMALIA_DETECTADA', mensaje: { contains: 'corredor geográfico' } }, orderBy: { createdAt: 'desc' } });
      configured = await db.notificacion.findFirst({ where: { usuarioId: fixture.generatorId, manifiestoId: item.id, titulo: item.liveRule } });
      if (direct && configured) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(direct && configured, 'Expected direct and configured synthetic GPS notices');
    for (const notice of [direct, configured]) {
      assert.match(notice.mensaje, /posiciones recibidas/i);
      assert.match(notice.mensaje, /hora de captura no disponible/i);
      assert.match(notice.mensaje, /no se compara una ruta vial autorizada/i);
      assert.match(notice.mensaje, /verific[aá].*transporte/i);
      assert.doesNotMatch(notice.mensaje, /se mantuvieron|est[aá] fuera/i);
    }
    const historical = await db.notificacion.findUniqueOrThrow({ where: { id: item.historicalId } });
    assert.equal(historical.mensaje, fixture.historicalText);
    item.directNoticeId = direct.id; item.configuredNoticeId = configured.id;
    checks.push({ surface: Object.entries(fixture.cases).find(([, candidate]) => candidate === item)?.[0], received: 3,
      direct: true, configured: true, historicalUnchanged: true });
  }
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  await writeFile(path.join(out, 'gps-corridor-context-fixture.json'), JSON.stringify(fixture, null, 2), { mode: 0o600 });
  await writeFile(path.join(out, 'gps-corridor-context-http-proof.json'), JSON.stringify({ checks, synthetic: true, production: false,
    emailAttempts: 0, emailsSent: 0, push: false }, null, 2));
  console.log('Avisos de corredor generados desde tres GPS artificiales y cotejados.');
} finally { await db.$disconnect(); }
