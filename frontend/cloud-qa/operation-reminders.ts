import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operation-reminders-20261030'; assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true'); assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false'); assert.equal(process.env.VAPID_PUBLIC_KEY, ''); assert.equal(process.env.VAPID_PRIVATE_KEY, '');
assert.equal(process.env.TRAINING_DATABASE_URL, ''); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const phase = process.env.QA_OPERATION_PHASE; assert.ok(phase === 'before' || phase === 'after');
const dist = path.join(root, 'backend', phase === 'before' ? 'dist-qa-signature-representatives-20261030' : 'dist-qa-operation-reminders-20261030');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const prisma = backendRequire(path.join(dist, 'lib/prisma.js')).default;
const { ejecutarRecordatorios } = backendRequire(path.join(dist, 'jobs/recordatorio.job.js'));
const { notificationMailContent, notificationSourceEligible } = backendRequire(path.join(dist, 'services/notification-mail.service.js'));
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const tokenByEmail = new Map<string, string>();
async function request(email: string, url: string, method = 'GET', expected = 200) {
  assert.match(email, /@night-qa\.invalid$/);
  if (!tokenByEmail.has(email)) {
    const response = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(response.status, 200); tokenByEmail.set(email, (await response.json() as any).data.tokens.accessToken);
  }
  const response = await fetch('http://127.0.0.1:3037/api' + url, { method, headers: { Authorization: 'Bearer ' + tokenByEmail.get(email) } });
  assert.equal(response.status, expected, method + ' ' + url); return (await response.json() as any).data;
}

// The production job is exercised unchanged while its page query is restricted
// to IDs created here; it cannot generate notices for unrelated synthetic data.
const selected = new Set<string>(); let scopedReads = 0;
const delegate = prisma.manifiesto, originalFindMany = delegate.findMany.bind(delegate);
delegate.findMany = (args: any) => {
  if (!args?.where?.fechaEstimadaRetiro) return originalFindMany(args);
  assert.ok(selected.size, 'Do not run an unscoped sweep'); scopedReads++;
  return originalFindMany({ ...args, where: { AND: [args.where, { id: { in: [...selected] } }] } });
};
assert.equal(prisma.manifiesto.findMany, delegate.findMany);
try {
  const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } }); assert.match(company.razonSocial, /QA/i);
  const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
  const [generator, member, carrier, operator, multi] = await Promise.all([
    db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
    db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
    db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } }, include: { usuario: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: 'draft-multirole-20261024@night-qa.invalid' } }),
  ]);
  assert.equal(generator.usuario.email, fixture.owner);
  for (const actor of [generator, carrier, operator]) { assert.equal(actor.activo, true); assert.equal(actor.usuario.activo, true); assert.match(actor.usuario.email, /@night-qa\.invalid$/); }
  for (const user of [member, multi]) { assert.equal(user.activo, true); assert.equal(user.emailVerified, true); assert.match(user.email, /@night-qa\.invalid$/); }
  const grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
  assert.equal(grant.activa, true); assert.equal(grant.todosEstablecimientos, true);
  const site = await db.establecimientoEmpresa.findFirstOrThrow({ where: { empresaId: company.id, activo: true } });
  const carrierActivity = await db.empresaActividad.findUniqueOrThrow({ where: { rol_actorId: { rol: 'TRANSPORTISTA', actorId: carrier.id } } });
  const carrierCompany = await db.empresa.findUniqueOrThrow({ where: { id: carrierActivity.empresaId } });
  const carrierGrant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: carrierActivity.id, usuarioId: multi.id } } });
  assert.equal(carrierActivity.activa, true); assert.equal(carrierCompany.activa, true); assert.equal(carrierGrant.activa, true);
  assert.equal(carrierGrant.todosEstablecimientos, true); assert.equal(carrier.cuit.replace(/\D/g, ''), carrierCompany.cuit);
  const expected = new Set([generator.usuarioId, carrier.usuarioId, operator.usuarioId, member.id, multi.id]); assert.equal(expected.size, 5);
  const now = new Date(), planned = new Date(now.getTime() + 12 * 3600000), run = randomUUID().slice(0, 10);
  const siteLatitude = -32.91234, siteLongitude = -68.81234;
  async function createManifest(tag: string, modalidad: 'FIJO' | 'IN_SITU', demo = false) {
    return db.manifiesto.create({ data: { numero: `QA-PREVISTA-${tag}-${run}`, generadorId: generator.id, transportistaId: carrier.id,
      operadorId: operator.id, creadoPorId: carrier.usuarioId, estado: 'APROBADO', modalidad, isDemoData: demo,
      fechaEstimadaRetiro: planned, contextoEmpresa: { empresaId: company.id, establecimientoId: site.id, rol: 'GENERADOR',
        razonSocial: company.razonSocial, domicilioLegal: { calle: 'Calle QA', localidad: '', departamento: '' },
        establecimiento: { id: site.id, nombre: site.nombre, domicilio: 'Calle QA', latitud: siteLatitude, longitud: siteLongitude } } } });
  }
  const origin = await createManifest('ORIGEN', 'IN_SITU'); selected.add(origin.id);
  const first = await ejecutarRecordatorios(now);
  const notices = await db.notificacion.findMany({ where: { manifiestoId: origin.id } });
  if (phase === 'before') {
    assert.equal(first, 1); assert.equal(notices.length, 2);
    assert.ok(notices.some((n: any) => n.usuarioId === carrier.usuarioId && /retiro/i.test(n.titulo)));
    assert.ok(notices.some((n: any) => n.usuarioId === generator.usuarioId && /retirara/i.test(n.mensaje)));
    assert.ok(!notices.some((n: any) => n.usuarioId === operator.usuarioId));
    writeFileSync(path.join(out, 'integration-before.json'), JSON.stringify({ synthetic: true, originNotices: 2,
      falsePickupNotice: true, operatorMissing: true }));
    console.log('Referencia artificial: el tratamiento en origen produjo un retiro inexistente y omitió al operador.');
  } else {
    assert.equal(first, 1); assert.deepEqual(notices.map((n: any) => n.usuarioId).sort(), [...expected].sort());
    for (const n of notices) {
      assert.equal(n.titulo, 'Tratamiento en origen previsto'); assert.match(n.mensaje, /No hay retiro, traslado ni GPS/);
      assert.equal(JSON.parse(n.datos).modalidad, 'IN_SITU');
    }
    assert.equal(await ejecutarRecordatorios(now), 0); assert.equal(await db.notificacion.count({ where: { manifiestoId: origin.id } }), expected.size);
    const rep = notices.find((n: any) => n.usuarioId === member.id); assert.ok(rep);
    const carrierRep = notices.find((n: any) => n.usuarioId === multi.id); assert.ok(carrierRep);
    assert.equal(JSON.parse(rep.datos).accesosEmpresa[0].establecimientoId, site.id);
    assert.equal(JSON.parse(carrierRep.datos).accesosEmpresa[0].actividadId, carrierActivity.id);
    const repMailNotice = { ...rep, email: member.email, activo: member.activo, emailVerified: member.emailVerified, notifEmail: member.notifEmail, rol: member.rol };
    assert.equal(await notificationSourceEligible(repMailNotice, 'alertas'), true);
    const originMail = notificationMailContent(repMailNotice); assert.ok(originMail?.html.includes('/notificaciones/' + rep.id));
    assert.match(originMail.html, /No hay retiro, traslado ni GPS/); writeFileSync(path.join(out, 'origin-mail.html'), originMail.html);
    const visible = await request(fixture.member, '/notificaciones/' + rep.id);
    assert.equal(visible.manifiestoId, origin.id);
    await request('generador2@night-qa.invalid', '/notificaciones/' + rep.id, 'GET', 404);
    try {
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: false } });
      const hidden = await request(fixture.member, '/notificaciones/' + rep.id);
      assert.equal(hidden.titulo, 'Aviso no disponible'); assert.equal(hidden.manifiestoId, null); assert.doesNotMatch(JSON.stringify(hidden), new RegExp(origin.numero));
      assert.equal(await notificationSourceEligible(repMailNotice, 'alertas'), false);
      const read = await request(fixture.member, '/notificaciones/' + rep.id + '/leida', 'PUT'); assert.doesNotMatch(JSON.stringify(read), new RegExp(origin.numero));
    } finally {
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
        todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
    }
    assert.deepEqual(await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: grant.id } }), grant);
    selected.clear(); const fixed = await createManifest('TRASLADO', 'FIJO'); selected.add(fixed.id);
    const fecha = planned.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' });
    await db.notificacion.create({ data: { id: 'qa-legacy-' + run, usuarioId: generator.usuarioId, manifiestoId: fixed.id,
      tipo: 'ALERTA_SISTEMA', titulo: 'QA recordatorio anterior', mensaje: 'QA histórico', datos: JSON.stringify({ tipo: 'recordatorio_retiro', fechaRetiro: fecha }) } });
    const concurrent = await Promise.all([ejecutarRecordatorios(now), ejecutarRecordatorios(now)]);
    assert.equal(concurrent.reduce((a: number, b: number) => a + b, 0), 1);
    const fixedNotices = await db.notificacion.findMany({ where: { manifiestoId: fixed.id } });
    assert.deepEqual(fixedNotices.map((n: any) => n.usuarioId).sort(), [...expected].sort());
    assert.equal(fixedNotices.filter((n: any) => n.usuarioId === generator.usuarioId).length, 1);
    for (const n of fixedNotices.filter((n: any) => n.usuarioId !== generator.usuarioId)) {
      assert.equal(n.titulo, 'Retiro previsto'); assert.doesNotMatch(n.mensaje, /mañana|manana/i);
    }
    const fixedRep = fixedNotices.find((n: any) => n.usuarioId === member.id); assert.ok(fixedRep);
    const fixedMailNotice = { ...fixedRep, email: member.email, activo: member.activo, emailVerified: member.emailVerified, notifEmail: member.notifEmail, rol: member.rol };
    assert.equal(await notificationSourceEligible(fixedMailNotice, 'alertas'), true);
    const later = new Date(planned.getTime() + 86400000);
    await db.manifiesto.update({ where: { id: fixed.id }, data: { fechaEstimadaRetiro: later } });
    assert.equal(await notificationSourceEligible(fixedMailNotice, 'alertas'), false);
    assert.equal(await ejecutarRecordatorios(new Date(now.getTime() + 86400000)), 1);
    assert.equal(await db.notificacion.count({ where: { manifiestoId: fixed.id } }), 10);
    selected.clear(); const browserFixed = await createManifest('WEB', 'FIJO'); selected.add(browserFixed.id);
    assert.equal(await ejecutarRecordatorios(now), 1);
    const browserFixedRep = await db.notificacion.findFirstOrThrow({ where: { manifiestoId: browserFixed.id, usuarioId: member.id } });
    const browserFixedCarrier = await db.notificacion.findFirstOrThrow({ where: { manifiestoId: browserFixed.id, usuarioId: carrier.usuarioId } });
    const mapUrl = JSON.parse(browserFixedCarrier.datos).mapsUrl;
    assert.equal(mapUrl, `https://maps.google.com/?q=${siteLatitude},${siteLongitude}`);
    assert.equal(JSON.parse(browserFixedRep.datos).mapsUrl, undefined);
    const browserMailNotice = { ...browserFixedRep, email: member.email, activo: member.activo, emailVerified: member.emailVerified, notifEmail: member.notifEmail, rol: member.rol };
    assert.equal(await notificationSourceEligible(browserMailNotice, 'alertas'), true);
    const fixedMail = notificationMailContent(browserMailNotice); assert.ok(fixedMail?.html.includes('/notificaciones/' + browserFixedRep.id));
    writeFileSync(path.join(out, 'fixed-mail.html'), fixedMail.html);
    selected.clear(); const closing = await createManifest('CIERRE', 'FIJO'); selected.add(closing.id);
    let ready!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { ready = resolve; }); const held = new Promise<void>(resolve => { release = resolve; });
    const change = db.$transaction(async (tx: any) => { await tx.manifiesto.update({ where: { id: closing.id }, data: { estado: 'EN_TRANSITO' } }); ready(); await held; }, { timeout: 15000 });
    await locked;
    let settled = false; const concurrentJob = ejecutarRecordatorios(now).then((count: number) => { settled = true; return count; });
    try { await new Promise(resolve => setTimeout(resolve, 350)); assert.equal(settled, false); } finally { release(); }
    await change; assert.equal(await concurrentJob, 0); assert.equal(await db.notificacion.count({ where: { manifiestoId: closing.id } }), 0);
    selected.clear(); const demo = await createManifest('CAP', 'IN_SITU', true); selected.add(demo.id);
    assert.equal(await ejecutarRecordatorios(now), 0); assert.equal(await db.notificacion.count({ where: { manifiestoId: demo.id } }), 0);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    writeFileSync(path.join(out, 'fixture.json'), JSON.stringify({ synthetic: true, member: fixture.member, notice: rep.id,
      manifestId: origin.id, numero: origin.numero, title: rep.titulo, company: company.id, activity: activity.id, site: site.id,
      fixedNotice: browserFixedRep.id, fixedId: browserFixed.id, fixedNumero: browserFixed.numero, carrier: carrier.usuario.email, mapUrl }));
    writeFileSync(path.join(out, 'integration-after.json'), JSON.stringify({ synthetic: true, originRecipients: expected.size,
      representativeRevokedHidden: true, foreign404: true, duplicate: 0, legacyPerPerson: true, concurrentDuplicates: 0,
      rescheduledRecipients: expected.size, obsoleteMailSuppressed: true, concurrentTransitionNotices: 0, trainingNotices: 0,
      emailAttempts: 0, emailSent: 0, pushEnabled: false }));
    console.log('Modalidad, destinatarios, revocación, reprogramación y concurrencia verificados en datos artificiales.');
  }
  assert.ok(scopedReads > 0);
} finally { delegate.findMany = originalFindMany; await prisma.$disconnect(); await db.$disconnect(); }
