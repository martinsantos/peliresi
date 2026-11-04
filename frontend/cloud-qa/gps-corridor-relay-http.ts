import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.QA_ARTIFACTS, '/work/sitrep/.qa-corridor-relay-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const base = 'http://127.0.0.1:4177/api', ruleIds: string[] = [];
async function request(method: string, url: string, token?: string, body?: unknown) {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json',
    Cookie: 'sitrep_qa_client=127.44.22.18', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}
async function waitForNotices(manifestId: string, adminId: string, generatorId: string, rule: string) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const [direct, configured] = await Promise.all([
      db.notificacion.findFirst({ where: { usuarioId: adminId, manifiestoId: manifestId,
        tipo: 'ANOMALIA_DETECTADA', mensaje: { contains: 'corredor geográfico' } } }),
      db.notificacion.findFirst({ where: { usuarioId: generatorId, manifiestoId: manifestId, titulo: rule } }),
    ]);
    if (direct && configured) return { direct, configured };
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('No llegaron los avisos artificiales del corredor');
}
try {
  const [generator, carrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({ where: { email: 'generador@night-qa.invalid' }, include: { generador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' }, include: { transportista: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'operador@night-qa.invalid' }, include: { operador: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
  for (const actor of [generator.generador, carrier.transportista, operator.operador]) assert.match(actor.razonSocial, /^QA /);
  for (const actor of [generator.generador, operator.operador]) {
    assert.ok(Number.isFinite(actor.latitud) && Number.isFinite(actor.longitud));
  }
  const login = await request('POST', '/auth/login', undefined, { email: carrier.email, password: 'OnlyLocal-NightQA-2026!' });
  assert.equal(login.status, 200);
  const token = login.body.data.tokens.accessToken, run = randomUUID().slice(0, 8);
  const cases: Record<string, any> = {}, checks: any[] = [];
  for (const [index, surface] of ['web-desktop', 'app'].entries()) {
    const manifest = await db.manifiesto.create({ data: { numero: `QA-CORREDOR-RELEVO-${run}-${index}`,
      generadorId: generator.generador.id, transportistaId: carrier.transportista.id, operadorId: operator.operador.id,
      creadoPorId: carrier.id, estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaRetiro: new Date(), isDemoData: true },
      select: { id: true, numero: true } });
    const ruleName = `QA corredor relevo ${run}-${index}`;
    const rule = await db.reglaAlerta.create({ data: { nombre: ruleName, evento: 'ANOMALIA_GPS', activa: true,
      creadoPorId: admin.id, condicion: JSON.stringify({ all: [{ manifiestoId: manifest.id },
        { tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO' }] }), destinatarios: '["GENERADOR"]' } });
    ruleIds.push(rule.id);
    const point = () => ({ puntoId: randomUUID(), latitud: -30, longitud: -66 });
    for (let i = 0; i < 2; i++) {
      const result = await request('POST', `/manifiestos/${manifest.id}/ubicacion-idempotente`, token, point());
      assert.equal(result.status, 200, JSON.stringify(result.body));
    }
    const handoff = await request('POST', `/manifiestos/${manifest.id}/tramos`, token,
      { id: randomUUID(), anteriorId: null, tipo: 'EXTERNO', datos: {}, motivo: 'Rotura artificial de QA' });
    assert.equal(handoff.status, 201, JSON.stringify(handoff.body));
    const leg = handoff.body.data.tramo, access = handoff.body.data.acceso;
    const endpoint = `/seguimiento-relevo/${leg.id}/ubicacion-idempotente`;
    const state = await request('GET', `/seguimiento-relevo/${leg.id}`, access);
    assert.equal(state.status, 200);
    assert.ok(!Object.hasOwn(state.body.data, 'generador') && !Object.hasOwn(state.body.data, 'latitud'));
    let last: ReturnType<typeof point> | undefined;
    for (let i = 0; i < 3; i++) {
      last = point();
      const result = await request('POST', endpoint, access, last);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.data.idempotencia.repetido, false);
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 750));
        assert.equal(await db.notificacion.count({ where: { usuarioId: admin.id, manifiestoId: manifest.id,
          tipo: 'ANOMALIA_DETECTADA', mensaje: { contains: 'corredor geográfico' } } }), 0,
          'Los puntos del transporte original no completan las tres muestras del relevo');
      }
    }
    const notices = await waitForNotices(manifest.id, admin.id, generator.id, ruleName);
    for (const notice of [notices.direct, notices.configured]) {
      assert.match(notice.mensaje, /tramo de relevo 1/i);
      assert.match(notice.mensaje, /hora de captura no disponible/i);
      assert.match(notice.mensaje, /no se compara una ruta vial autorizada/i);
    }
    const repeat = await request('POST', endpoint, access, last);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.data.idempotencia.repetido, true);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: manifest.id, tramoId: leg.id } }), 3);
    assert.equal(await db.trackingGPS.count({ where: { manifiestoId: manifest.id, tramoId: null } }), 2);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: manifest.id, tipo: 'INCIDENTE',
      descripcion: { startsWith: 'Anomalía GPS detectada' } } }), 0);
    cases[surface] = { ...manifest, ruleName, legId: leg.id };
    checks.push({ surface, originPoints: 2, relayPoints: 3, noEarlyNotice: true, direct: true,
      configured: true, retryDeduplicated: true, inventedIncidentAuthor: false, capabilityHidesOrigin: true });
  }
  assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
  assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'corridor-relay-private.json'), JSON.stringify({ cases }), { mode: 0o600 });
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'corridor-relay-http-proof.json'), JSON.stringify({
    synthetic: true, production: false, checks, emailAttempts: 0, emailsSent: 0, push: false,
  }, null, 2));
  console.log(JSON.stringify({ synthetic: true, checks }));
} finally {
  if (ruleIds.length) await db.reglaAlerta.updateMany({ where: { id: { in: ruleIds } }, data: { activa: false } });
  await db.$disconnect();
}
