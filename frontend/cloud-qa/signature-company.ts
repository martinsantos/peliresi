import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-signature-representatives-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true');
assert.equal(process.env.DISABLE_EMAILS, 'true'); assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DATABASE_URL, ''); assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const phase = process.env.QA_SIGNATURE_PHASE; assert.ok(phase === 'before' || phase === 'after');
const dist = path.join(root, 'backend', phase === 'before' ? 'dist-qa-eventual-notices-20261030' : 'dist-qa-signature-representatives-20261030');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const prisma = backendRequire(path.join(dist, 'lib/prisma.js')).default;
const { ejecutarRecordatorioFirma } = backendRequire(path.join(dist, 'jobs/manifestSignatureReminder.job.js'));
const { notificationMailContent, notificationSourceEligible } = backendRequire(path.join(dist, 'services/notification-mail.service.js'));
const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-uiux-final-7c057295-20261027/onboarding-ux-fixture.json', 'utf8'));
assert.match(fixture.owner, /@night-qa\.invalid$/); assert.match(fixture.member, /@night-qa\.invalid$/);
const tokenByEmail = new Map<string, string>();
async function request(email: string, url: string, method = 'GET', expected = 200) {
  assert.match(email, /@night-qa\.invalid$/);
  if (!tokenByEmail.has(email)) {
    const response = await fetch('http://127.0.0.1:3037/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'OnlyLocal-NightQA-2026!' }) });
    assert.equal(response.status, 200, 'synthetic login'); tokenByEmail.set(email, (await response.json() as any).data.tokens.accessToken);
  }
  const response = await fetch('http://127.0.0.1:3037/api' + url, { method, headers: { Authorization: 'Bearer ' + tokenByEmail.get(email) } });
  assert.equal(response.status, expected, method + ' ' + url); return (await response.json() as any).data;
}

// The job is real. Restrict its page query to the IDs created by this test so
// that one synthetic rehearsal cannot generate reminders for unrelated QA data.
const selected = new Set<string>();
const delegate = prisma.manifiesto, originalFindMany = delegate.findMany.bind(delegate);
let scopedReads = 0;
delegate.findMany = (args: any) => {
  if (!args?.where?.fechaFirma) return originalFindMany(args);
  assert.ok(selected.size, 'Do not evaluate an unscoped reminder sweep'); scopedReads++;
  return originalFindMany({ ...args, where: { AND: [args.where, { id: { in: [...selected] } }] } });
};
assert.equal(prisma.manifiesto.findMany, delegate.findMany, 'The synthetic job scope must be active');
let grant: any;
try {
  const company = await db.empresa.findUniqueOrThrow({ where: { id: fixture.companyId } }); assert.match(company.razonSocial, /QA/i);
  const activity = await db.empresaActividad.findFirstOrThrow({ where: { empresaId: company.id, rol: 'GENERADOR', activa: true } });
  const [generator, member, carrier, operator] = await Promise.all([
    db.generador.findUniqueOrThrow({ where: { id: activity.actorId }, include: { usuario: true } }),
    db.usuario.findUniqueOrThrow({ where: { email: fixture.member } }),
    db.transportista.findFirstOrThrow({ where: { usuario: { email: 'transportista@night-qa.invalid' } }, include: { usuario: true } }),
    db.operador.findFirstOrThrow({ where: { usuario: { email: 'operador@night-qa.invalid' } }, include: { usuario: true } }),
  ]);
  assert.equal(generator.usuario.email, fixture.owner); assert.equal(generator.usuario.activo, true);
  assert.equal(member.activo, true); assert.equal(member.emailVerified, true);
  assert.match(carrier.razonSocial, /^QA /); assert.match(operator.razonSocial, /^QA /);
  grant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: activity.id, usuarioId: member.id } } });
  assert.equal(grant.activa, true); assert.equal(grant.todosEstablecimientos, true);
  const site = await db.establecimientoEmpresa.findFirstOrThrow({ where: { empresaId: company.id, activo: true } });
  const at = new Date(), run = randomUUID().slice(0, 10);
  async function createManifest(tag: string, days: number) {
    return db.manifiesto.create({ data: { numero: `QA-FIRMA-${tag}-${run}`, generadorId: generator.id, transportistaId: carrier.id,
      operadorId: operator.id, creadoPorId: carrier.usuarioId, estado: 'EN_TRANSITO', modalidad: 'FIJO', isDemoData: false,
      fechaFirma: new Date(at.getTime() - days * 86400000), fechaRetiro: new Date(at.getTime() - days * 86400000),
      contextoEmpresa: { empresaId: company.id, establecimientoId: site.id } } });
  }
  const manifest = await createManifest('AVISO', 24); selected.add(manifest.id);
  const first = await ejecutarRecordatorioFirma(at), repeated = await ejecutarRecordatorioFirma(at);
  const notices = await db.notificacion.findMany({ where: { manifiestoId: manifest.id } });
  const representative = notices.find((n: any) => n.usuarioId === member.id);
  assert.equal(repeated, 0); assert.equal(notices.filter((n: any) => n.usuarioId === generator.usuarioId).length, 1);
  if (phase === 'before') {
    assert.equal(first, 3); assert.equal(representative, undefined);
    selected.clear(); const closing = await createManifest('CIERRE-ANTERIOR', 24); selected.add(closing.id);
    let ready!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { ready = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const closure = db.$transaction(async (tx: any) => {
      await tx.manifiesto.update({ where: { id: closing.id }, data: { estado: 'TRATADO' } }); ready(); await held;
    }, { timeout: 15000 });
    await locked;
    const concurrentJob = ejecutarRecordatorioFirma(at);
    let beforeClosure: number | 'waiting';
    try { beforeClosure = await Promise.race([concurrentJob, new Promise<'waiting'>(resolve => setTimeout(() => resolve('waiting'), 1500))]); }
    finally { release(); }
    await closure; await concurrentJob;
    const staleNotices = await db.notificacion.count({ where: { manifiestoId: closing.id } });
    writeFileSync(path.join(out, 'integration-before.json'), JSON.stringify({ synthetic: true, direct: first, representative: 0, duplicate: repeated,
      concurrentClosureFinishedBeforeCommit: beforeClosure !== 'waiting', staleNotices }));
    assert.equal(beforeClosure, 3); assert.equal(staleNotices, 3);
    console.log('Referencia artificial: falta el representante y se generan avisos durante un cierre concurrente.');
  } else {
    // Another pre-existing artificial account is authorized for the carrier.
    // Check its independent company, actor and grant before expecting its notice.
    const multi = await db.usuario.findUniqueOrThrow({ where: { email: 'draft-multirole-20261024@night-qa.invalid' } });
    const carrierActivity = await db.empresaActividad.findUniqueOrThrow({ where: { rol_actorId: { rol: 'TRANSPORTISTA', actorId: carrier.id } } });
    const carrierCompany = await db.empresa.findUniqueOrThrow({ where: { id: carrierActivity.empresaId } });
    const carrierGrant = await db.autorizacionEmpresa.findUniqueOrThrow({ where: { actividadId_usuarioId: { actividadId: carrierActivity.id, usuarioId: multi.id } } });
    assert.equal(multi.activo, true); assert.equal(multi.emailVerified, true); assert.equal(carrierActivity.activa, true);
    assert.equal(carrierCompany.activa, true); assert.equal(carrier.cuit.replace(/\D/g, ''), carrierCompany.cuit);
    assert.equal(carrierGrant.activa, true); assert.equal(carrierGrant.todosEstablecimientos, true);
    const expected = new Set([generator.usuarioId, carrier.usuarioId, operator.usuarioId, member.id, multi.id]);
    assert.equal(expected.size, 5); assert.equal(first, expected.size); assert.ok(representative);
    assert.deepEqual(notices.map((n: any) => n.usuarioId).sort(), [...expected].sort());
    const multiNotice = notices.find((n: any) => n.usuarioId === multi.id); assert.ok(multiNotice);
    const multiData = JSON.parse(multiNotice.datos!);
    assert.equal(multiData.destino, 'representante'); assert.equal(multiData.accesosEmpresa[0].rol, 'TRANSPORTISTA');
    assert.equal(multiData.accesosEmpresa[0].actividadId, carrierActivity.id);
    const data = JSON.parse(representative.datos!);
    assert.equal(data.fase, 'SEMANA'); assert.equal(data.destino, 'representante');
    assert.equal(data.accesosEmpresa[0].actividadId, activity.id); assert.equal(data.accesosEmpresa[0].establecimientoId, site.id);
    const mailNotice = { ...representative, email: member.email, activo: member.activo, emailVerified: member.emailVerified,
      notifEmail: member.notifEmail, rol: member.rol };
    assert.equal(await notificationSourceEligible(mailNotice, 'alertas'), true);
    const mail = notificationMailContent(mailNotice); assert.ok(mail?.html.includes('/notificaciones/' + representative.id));
    writeFileSync(path.join(out, 'representative-mail.html'), mail.html);
    const multiMailNotice = { ...multiNotice, email: multi.email, activo: multi.activo, emailVerified: multi.emailVerified,
      notifEmail: multi.notifEmail, rol: multi.rol };
    assert.equal(await notificationSourceEligible(multiMailNotice, 'alertas'), true);
    const multiMail = notificationMailContent(multiMailNotice); assert.ok(multiMail?.html.includes('/notificaciones/' + multiNotice.id));
    writeFileSync(path.join(out, 'multirole-mail.html'), multiMail.html);
    const visible = await request(fixture.member, '/notificaciones/' + representative.id);
    assert.equal(visible.manifiestoId, manifest.id); assert.equal(JSON.parse(visible.datos).accesosEmpresa[0].actividadId, activity.id);
    await request('generador2@night-qa.invalid', '/notificaciones/' + representative.id, 'GET', 404);
    try {
      for (const reason of ['other-site', 'revoked']) {
        await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: reason === 'other-site'
          ? { todosEstablecimientos: false, establecimientoIds: ['qa-sede-distinta'] } : { activa: false } });
        const hidden = await request(fixture.member, '/notificaciones/' + representative.id);
        assert.equal(hidden.titulo, 'Aviso no disponible'); assert.equal(hidden.manifiestoId, null);
        assert.doesNotMatch(JSON.stringify(hidden), new RegExp(manifest.numero));
        assert.equal(await notificationSourceEligible(mailNotice, 'alertas'), false);
        const read = await request(fixture.member, '/notificaciones/' + representative.id + '/leida', 'PUT');
        assert.doesNotMatch(JSON.stringify(read), new RegExp(manifest.numero));
      }
    } finally {
      await db.autorizacionEmpresa.update({ where: { id: grant.id }, data: { activa: grant.activa,
        todosEstablecimientos: grant.todosEstablecimientos, establecimientoIds: grant.establecimientoIds, updatedAt: grant.updatedAt } });
    }
    assert.deepEqual(await db.autorizacionEmpresa.findUniqueOrThrow({ where: { id: grant.id } }), grant);
    assert.equal((await request(fixture.member, '/notificaciones/' + representative.id)).manifiestoId, manifest.id);
    selected.clear(); const thirty = await createManifest('TREINTA', 31); selected.add(thirty.id);
    const simultaneous = await Promise.all([ejecutarRecordatorioFirma(at), ejecutarRecordatorioFirma(at)]);
    assert.equal(simultaneous.reduce((a: number, b: number) => a + b, 0), expected.size);
    const thirtyNotices = await db.notificacion.findMany({ where: { manifiestoId: thirty.id } });
    assert.equal(thirtyNotices.length, expected.size);
    assert.deepEqual(thirtyNotices.map((n: any) => n.usuarioId).sort(), [...expected].sort());
    assert.equal(JSON.parse(thirtyNotices.find((n: any) => n.usuarioId === member.id).datos).fase, 'TREINTA_DIAS');
    selected.clear(); const closing = await createManifest('CIERRE', 24); selected.add(closing.id);
    let ready!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { ready = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const closure = db.$transaction(async (tx: any) => {
      await tx.manifiesto.update({ where: { id: closing.id }, data: { estado: 'TRATADO' } }); ready(); await held;
    }, { timeout: 15000 });
    await locked;
    let settled = false;
    const concurrentJob = ejecutarRecordatorioFirma(at).then((count: number) => { settled = true; return count; });
    try {
      await new Promise(resolve => setTimeout(resolve, 350));
      assert.equal(settled, false, 'The reminder must wait for the concurrent closure');
    } finally { release(); }
    await closure; assert.equal(await concurrentJob, 0);
    assert.equal(await db.notificacion.count({ where: { manifiestoId: closing.id } }), 0);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    writeFileSync(path.join(out, 'fixture.json'), JSON.stringify({ synthetic: true, member: fixture.member, notice: representative.id,
      multi: multi.email, multiNotice: multiNotice.id, manifestId: manifest.id, numero: manifest.numero,
      title: representative.titulo, company: company.id, activity: activity.id, site: site.id }));
    writeFileSync(path.join(out, 'integration-after.json'), JSON.stringify({ synthetic: true, titulars: 3, representatives: 2, duplicate: 0,
      thirtyDayRecipients: expected.size, simultaneousDuplicates: 0, revokedHidden: true, foreign404: true, staleMailSuppressed: true,
      concurrentClosureNotices: 0, emailAttempts: 0, emailSent: 0, pushEnabled: false }));
    console.log('Avisos, revocación, concurrencia y correo renderizado verificados en datos artificiales.');
  }
  assert.ok(scopedReads > 0, 'The synthetic reminder sweep must use its explicit scope');
} finally { delegate.findMany = originalFindMany; await prisma.$disconnect(); await db.$disconnect(); }
