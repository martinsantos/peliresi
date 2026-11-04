import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true');
const { PrismaClient } = backendRequire('@prisma/client');
const { alertaSubscriber } = backendRequire('./dist/subscribers/alerta.subscriber.js');
const { matchesAlertCondition, hasConfiguredTransitThreshold } = backendRequire('./dist/services/alertRuleCondition.service.js');
const db = new PrismaClient(), out = process.env.QA_ARTIFACTS!;
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const ids: string[] = [], run = randomUUID().slice(0, 8);
let grant: any, temporarySite: string | undefined;
const tokens = new Map<string, string>(), base = 'http://127.0.0.1:3037/api';
async function call(email: string, route: string, method = 'GET', headers: Record<string, string> = {}, status = 200) {
 assert.match(email, /@night-qa\.invalid$/);
 if (!tokens.has(email)) {
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
  const body = await login.json() as any; assert.equal(login.status, 200, 'Synthetic login'); tokens.set(email, body.data.tokens.accessToken);
 }
 const response = await fetch(base + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(email), ...headers } });
 const body = await response.json() as any; assert.equal(response.status, status, route); return body.data;
}
try {
  const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } });
  assert.match(company.razonSocial, /QA/i);
  const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
  const [generator, member, carrier, operator, admin] = await Promise.all([
    db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
    db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
    db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' } }),
  ]);
  assert.equal(generator.usuario.email, fixture.owner);
  assert.equal(generator.usuario.activo, true); assert.equal(member.activo, true); assert.equal(member.emailVerified, true);
  assert.match(carrier.razonSocial, /^QA /); assert.match(operator.razonSocial, /^QA /);
  grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
  let site = await db.establecimientoEmpresa.findFirst({ where: { empresaId: company.id, activo: true,
    ...(grant.todosEstablecimientos ? {} : { id: { in: grant.establecimientoIds } }) } });
  if (!site && grant.todosEstablecimientos) {
    site = await db.establecimientoEmpresa.create({ data: { empresaId: company.id, codigo: `QA-ALERTA-${run}`,
      nombre: 'QA Sede de alerta', domicilio: 'Domicilio artificial QA', certificados: [] } });
    temporarySite = site.id;
  }
  assert.ok(site, 'La autorización artificial debe incluir una sede activa');
  assert.equal(grant.activa, true); assert.ok(grant.todosEstablecimientos || grant.establecimientoIds.includes(site.id));
  const manifest = await db.manifiesto.create({ data: { numero: `QA-REP-ALERT-${run}`, generadorId: generator.id,
    transportistaId: carrier.id, operadorId: operator.id, creadoPorId: carrier.usuarioId, estado: 'EN_TRANSITO', modalidad: 'FIJO',
    fechaRetiro: new Date(Date.now() - 25 * 3_600_000), isDemoData: true,
    contextoEmpresa: { empresaId: company.id, establecimientoId: site.id } } });
  const event = { type: 'DURACION_TRANSITO_OBSERVADA', manifiestoId: manifest.id, numero: manifest.numero,
    horasTransito: 25, userId: carrier.usuarioId };
  const existing = await db.reglaAlerta.findMany({ where: { activa: true, evento: 'TIEMPO_EXCESIVO' } });
  assert.ok(existing.every((rule: any) => !hasConfiguredTransitThreshold(rule.condicion) || !matchesAlertCondition(rule.condicion, event)),
    'Las reglas previas no deben coincidir con el manifiesto artificial');
  const duration = await db.reglaAlerta.create({ data: { nombre: `QA alerta representante ${run}`, evento: 'TIEMPO_EXCESIVO', activa: true,
    condicion: JSON.stringify({ all: [{ horasTransito: { gte: 24 } }, { manifiestoId: manifest.id }] }),
    destinatarios: '["GENERADOR"]', creadoPorId: admin.id } });
  ids.push(duration.id);
  await alertaSubscriber(event);
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, titulo: duration.nombre } });
  const observed = { synthetic: true, owner: notices.filter((n: any) => n.usuarioId === generator.usuarioId).length,
    representative: notices.filter((n: any) => n.usuarioId === member.id).length,
    others: notices.filter((n: any) => ![generator.usuarioId, member.id].includes(n.usuarioId)).length };
  writeFileSync(path.join(out, process.env.QA_BASELINE === 'true' ? 'company-rule-duration-baseline.json' : 'company-rule-duration-observed.json'), JSON.stringify(observed, null, 2));
  if (process.env.QA_BASELINE === 'true') {
    assert.deepEqual(observed, { synthetic: true, owner: 1, representative: 0, others: 0 });
  } else {
    assert.deepEqual(observed, { synthetic: true, owner: 1, representative: 1, others: 0 });
    const repNotice = notices.find((n: any) => n.usuarioId === member.id);
    assert.ok(repNotice); assert.equal(JSON.parse(repNotice.datos).accesosEmpresa[0].actividadId, activity.id);
    assert.equal(JSON.parse(repNotice.datos).accesosEmpresa[0].establecimientoId, site.id);
    await alertaSubscriber(event);
    assert.equal(await db.notificacion.count({ where: { manifiestoId: manifest.id, titulo: duration.nombre, usuarioId: member.id } }), 1);
    const visible = await call(fixture.member, '/notificaciones/' + repNotice.id);
    assert.equal(visible.titulo, duration.nombre); assert.equal(visible.manifiestoId, manifest.id);
    await call('generador2@night-qa.invalid', '/notificaciones/' + repNotice.id, 'GET', {}, 404);
    const companyHeaders = { 'X-SITREP-Empresa': company.id, 'X-SITREP-Empresa-Actividad': activity.id, 'X-SITREP-Establecimiento': site.id };
    await call(fixture.member, '/manifiestos/' + manifest.id, 'GET', companyHeaders);

    // A distinct general rule uses the same company authorization and must not
    // send the generator's representative an operator-only alert.
    const anomaly = { type: 'ANOMALIA_GPS', manifiestoId: manifest.id, numero: manifest.numero, tipoAnomalia: 'GPS_PERDIDO',
      severidad: 'MEDIA', descripcion: 'Observación artificial QA', userId: carrier.usuarioId };
    const previous = await db.reglaAlerta.findMany({ where: { activa: true, evento: 'ANOMALIA_GPS' } });
    assert.ok(previous.every((rule: any) => !matchesAlertCondition(rule.condicion, anomaly)));
    const generic = await db.reglaAlerta.create({ data: { nombre: `QA anomalía representante ${run}`, evento: 'ANOMALIA_GPS', activa: true,
      condicion: JSON.stringify({ manifiestoId: manifest.id }), destinatarios: '["GENERADOR"]', creadoPorId: admin.id } });
    ids.push(generic.id); await alertaSubscriber(anomaly);
    const genericNotices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, titulo: generic.nombre } });
    assert.deepEqual(genericNotices.map((n: any) => n.usuarioId).sort(), [generator.usuarioId, member.id].sort());
    assert.equal(JSON.parse(genericNotices.find((n: any) => n.usuarioId === member.id).datos).tipo, 'alerta_regla_manifiesto');
    const carrierRule = await db.reglaAlerta.create({ data: { nombre: `QA anomalía transporte ${run}`, evento: 'ANOMALIA_GPS', activa: true,
      condicion: JSON.stringify({ manifiestoId: manifest.id }), destinatarios: '["TRANSPORTISTA"]', creadoPorId: admin.id } });
    ids.push(carrierRule.id); await alertaSubscriber(anomaly);
    const carrierAlerts = await db.notificacion.count({ where: { manifiestoId: manifest.id, titulo: carrierRule.nombre, usuarioId: carrier.usuarioId } });
    assert.equal(carrierAlerts, process.env.QA_EXPECT_GPS_MISSING === 'true' ? 0 : 1,
      'Una observación automática de GPS debe avisar al transporte seleccionado que emitió la posición');
    const operatorRule = await db.reglaAlerta.create({ data: { nombre: `QA alerta operador ${run}`, evento: 'TIEMPO_EXCESIVO', activa: true,
      condicion: duration.condicion, destinatarios: '["OPERADOR"]', creadoPorId: admin.id } });
    ids.push(operatorRule.id); await alertaSubscriber(event);
    const operatorNotices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id, titulo: operatorRule.nombre } });
    assert.deepEqual(operatorNotices.map((n: any) => n.usuarioId), [operator.usuarioId]);

    try {
      for (const reason of ['other-site', 'revoked']) {
        await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: reason === 'other-site'
          ? { todosEstablecimientos: false, establecimientoIds: ['qa-sede-distinta'] } : { activa: false } });
        const hidden = await call(fixture.member, '/notificaciones/' + repNotice.id);
        assert.equal(hidden.titulo, 'Aviso no disponible'); assert.equal(hidden.manifiestoId, null); assert.equal(hidden.manifiesto, null);
        assert.doesNotMatch(JSON.stringify(hidden), new RegExp(manifest.numero));
        const list = await call(fixture.member, '/notificaciones?limit=500');
        assert.equal(list.notificaciones.find((n: any) => n.id === repNotice.id).titulo, 'Aviso no disponible');
        const marked = await call(fixture.member, '/notificaciones/' + repNotice.id + '/leida', 'PUT');
        assert.doesNotMatch(JSON.stringify(marked), new RegExp(manifest.numero));
        await call(fixture.member, '/manifiestos/' + manifest.id, 'GET', companyHeaders, 403);
      }
    } finally {
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
        todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
    }
    assert.equal((await call(fixture.member, '/notificaciones/' + repNotice.id)).titulo, duration.nombre);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    writeFileSync(path.join(out, 'company-rule-browser.json'), JSON.stringify({ synthetic: true, member: fixture.member,
      manifestId: manifest.id, numero: manifest.numero, notice: repNotice.id, title: duration.nombre,
      company: company.id, activity: activity.id, site: site.id }, null, 2), { mode: 0o600 });
    Object.assign(observed, { generalRule: true, selectedRoleOnly: true, carrierGpsNotified: true, duplicate: false, revokedHidden: true,
      otherSiteHidden: true, otherAccountDenied: true, noMailAttempts: true, noPush: true });
    writeFileSync(path.join(out, 'company-rule-final-proof.json'), JSON.stringify(observed, null, 2));
  }
  console.log(JSON.stringify(observed));
} finally {
  if (ids.length) await db.reglaAlerta.updateMany({ where: { id: { in: ids } }, data: { activa: false } });
  if (grant) {
    const restored = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: grant.id } });
    assert.deepEqual(restored, grant);
  }
  if (temporarySite && process.env.QA_KEEP_FIXTURE !== 'true') await db.establecimientoEmpresa.deleteMany({ where: { id: temporarySite, codigo: `QA-ALERTA-${run}` } });
  await db.$disconnect();
}
