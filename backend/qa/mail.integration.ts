/** Cloud-only PostgreSQL + loopback SMTP proof. No external provider or recipient. */
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const url = new URL(process.env.DATABASE_URL || '');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '55440');
assert.equal(url.pathname, '/sitrep_night_qa_20260926');
assert.equal(process.env.SMTP_HOST, '127.0.0.1');
assert.equal(process.env.SMTP_USER, '');
assert.equal(process.env.SMTP_PASS, '');
if (process.argv[2] === 'worker') {
  const { flushEmailQueue } = require('../dist/services/email.service.js');
  await flushEmailQueue();
  await require('../dist/lib/prisma.js').default.$disconnect();
} else {
  const messages: string[] = [];
  const sockets = new Set<import('node:net').Socket>();
  const smtp = createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8'); socket.write('220 loopback.invalid capture-only\r\n');
    let buffer = '', body = '', inData = false;
    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const at = buffer.indexOf('\r\n'), line = buffer.slice(0, at); buffer = buffer.slice(at + 2);
        if (inData) {
          if (line === '.') { messages.push(body); body = ''; inData = false; socket.write('250 captured locally\r\n'); }
          else body += line + '\r\n';
        } else if (/^(EHLO|HELO)/.test(line)) socket.write('250-loopback.invalid\r\n250 SIZE 1048576\r\n');
        else if (/^RCPT TO:/i.test(line)) socket.write(/@[^>\s]*\.invalid>?$/i.test(line) ? '250 synthetic recipient\r\n' : '550 synthetic addresses only\r\n');
        else if (line === 'DATA') { inData = true; socket.write('354 end with dot\r\n'); }
        else if (line === 'QUIT') { socket.end('221 bye\r\n'); }
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>(resolve => smtp.listen(0, '127.0.0.1', resolve));
  process.env.SMTP_PORT = String((smtp.address() as { port: number }).port);
  process.env.EMAIL_DAILY_LIMIT_TRANSACCIONAL = '1000';
  process.env.EMAIL_DAILY_LIMIT_ALERTA = '1000';
  const prisma = require('../dist/lib/prisma.js').default;
  const checks: string[] = [];
  function reload() {
    delete require.cache[require.resolve('../dist/services/email.service.js')];
    return require('../dist/services/email.service.js');
  }
  async function worker() {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', process.argv[1], 'worker'], { env: process.env, stdio: 'inherit' });
      child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('worker exit ' + code)));
    });
  }
  try {
    assert.equal(process.env.DISABLE_EMAILS, 'true');
    await reload().emailService.sendCuentaAprobadaEmail('account@qa.invalid', 'Persona QA');
    await reload().emailService.sendAlertEmail(['account@qa.invalid'], { nombre: 'Captura QA' }, null, {});
    assert.equal(messages.length, 0);
    assert.equal(await prisma.emailQueue.count({ where: { estado: 'SUPRIMIDO', sentAt: null } }), 2);
    checks.push('disabled transactional and digest are terminal, zero SMTP');

    const old = await prisma.emailQueue.create({ data: { to: 'old@qa.invalid', subject: 'old', html: '<p>old</p>', tipo: 'TRANSACCIONAL', estado: 'FALLIDO', createdAt: new Date('2020-01-01') } });
    process.env.DISABLE_EMAILS = 'false';
    await reload().flushEmailQueue();
    assert.equal(messages.length, 0);
    checks.push('turning off kill switch alone does not release history');

    process.env.EMAIL_DELIVERY_NOT_BEFORE = new Date().toISOString();
    process.env.EMAIL_EXTERNAL_ALERTS_ENABLED = 'true';
    process.env.EMAIL_EXTERNAL_ALERTS_ALLOWLIST = 'digest@qa.invalid';
    const service = reload();
    const calls: Array<[string, string[]]> = [
      ['sendEmailVerification', ['QA', 'synthetic-token']], ['sendRegistroPendienteEmail', ['QA', 'GENERADOR']],
      ['sendCuentaAprobadaEmail', ['QA']], ['sendNuevoRegistroAdminEmail', ['QA', 'OPERADOR']],
      ['sendPasswordResetEmail', ['QA', 'synthetic-token']], ['sendSolicitudEnviadaAdmin', ['QA', 'GENERADOR']],
      ['sendSolicitudObservadaEmail', ['QA', 'Corregir domicilio']], ['sendRespuestaCandidatoAdmin', ['QA']],
      ['sendSolicitudRechazadaEmail', ['QA', 'Documentación incompleta']], ['sendModificacionSolicitadaAdmin', ['QA', 'OPERADOR']],
      ['sendModificacionAprobadaEmail', ['QA']], ['sendModificacionRechazadaEmail', ['QA', 'Revisar datos']],
    ];
    for (const [method, args] of calls) await service.emailService[method]('account@qa.invalid', ...args);
    assert.equal(messages.length, calls.length);
    assert.equal(await prisma.emailQueue.count({ where: { estado: 'ENVIADO' } }), calls.length);
    assert.ok(messages.every(message => message.includes('multipart/alternative') && message.includes('text/plain') && message.includes('text/html')));
    checks.push('12 public template APIs -> PostgreSQL -> multipart SMTP capture');

    const baseline = messages.length;
    for (let i = 0; i < 20; i++) await prisma.emailQueue.create({ data: { to: 'retry@qa.invalid', subject: `retry-${i}`, html: `<p>unique-retry-${i}</p>`, tipo: 'TRANSACCIONAL', estado: 'FALLIDO', intentos: 1, nextRetryAt: new Date(0) } });
    for (let i = 0; i < 10; i++) await service.emailService.sendAlertEmail(['digest@qa.invalid'], { nombre: `digest-unique-${i}` }, null, {});
    await Promise.all([worker(), worker()]);
    const delivered = messages.slice(baseline);
    assert.equal(delivered.filter(body => /Subject: retry-\d+/.test(body)).length, 20);
    for (let i = 0; i < 20; i++) assert.equal(delivered.filter(body => body.includes(`Subject: retry-${i}\r\n`)).length, 1);
    assert.equal(await prisma.emailQueue.count({ where: { to: 'digest@qa.invalid', estado: 'ENVIADO' } }), 10);
    assert.equal(await prisma.emailQueue.count({ where: { to: 'retry@qa.invalid', estado: 'ENVIADO' } }), 20);
    assert.equal((await prisma.emailQueue.findUnique({ where: { id: old.id } })).estado, 'FALLIDO');
    const after = messages.length;
    await Promise.all([worker(), worker()]);
    assert.equal(messages.length, after);
    assert.equal(await prisma.emailQueue.count({ where: { estado: 'SUPRIMIDO' } }), 2);
    checks.push('two independent workers: 20 retries and 10 digest entries claimed once; subsequent pass sends nothing');
    checks.push('historical row preserved and disabled entries never replayed');
    process.env.EMAIL_NOTIFICATION_FAMILIES = 'solicitudes,soporte,inspecciones';
    const user = await prisma.usuario.create({ data: { nombre: 'Mail QA', email: 'notices@qa.invalid', password: 'not-a-login-credential', rol: 'ADMIN', activo: true, emailVerified: true } });
    await prisma.inspeccion.create({ data: { id: 'qa-inspection', numero: 'QA-MAIL-001', inspectorId: user.id } });
    const sourceNotices = [];
    for (const datos of [{ solicitudId: 'qa-application' }, { tipo: 'soporte', ticketId: 'qa-ticket' }, { inspeccionId: 'qa-inspection' }]) {
      sourceNotices.push(await prisma.notificacion.create({ data: { usuarioId: user.id, tipo: 'solicitudId' in datos ? 'SOLICITUD_ENVIADA' : 'INFO_GENERAL', titulo: 'QA', mensaje: 'No debe copiar contenido sensible', datos: JSON.stringify(datos) } }));
    }
    let rolledBackId = '';
    await assert.rejects(prisma.$transaction(async (tx: typeof prisma) => {
      const row = await tx.notificacion.create({ data: { usuarioId: user.id, tipo: 'SOLICITUD_ENVIADA', titulo: 'rollback', mensaje: 'rollback', datos: JSON.stringify({ solicitudId: 'rolled-back' }) } });
      rolledBackId = row.id; throw new Error('intentional QA rollback');
    }), /intentional QA rollback/);
    const beforeNotices = messages.length;
    await Promise.all([worker(), worker()]);
    assert.equal(messages.length - beforeNotices, 3);
    for (const source of sourceNotices) assert.equal((await prisma.emailQueue.findUnique({ where: { id: 'notification:' + source.id } })).estado, 'ENVIADO');
    assert.equal(await prisma.emailQueue.findUnique({ where: { id: 'notification:' + rolledBackId } }), null);
    await Promise.all([worker(), worker()]);
    assert.equal(messages.length - beforeNotices, 3);
    checks.push('committed application/support/inspection notices relayed once across two workers; transaction rollback produces no email');
    const { queueCommittedNotificationEmails } = require('../dist/services/notification-mail.service.js');
    for (const change of [{ activo: false }, { emailVerified: false }, { notifEmail: false }, { email: 'changed@qa.invalid' }]) {
      await prisma.usuario.update({ where: { id: user.id }, data: { activo: true, emailVerified: true, notifEmail: true, email: 'notices@qa.invalid' } });
      const notice = await prisma.notificacion.create({ data: { usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: 'QA current recipient', mensaje: 'QA', datos: JSON.stringify({ tipo: 'soporte', ticketId: 'qa-ticket' }) } });
      await queueCommittedNotificationEmails();
      assert.equal((await prisma.emailQueue.findUnique({ where: { id: 'notification:' + notice.id } })).estado, 'PENDIENTE');
      await prisma.usuario.update({ where: { id: user.id }, data: change });
      const count = messages.length;
      await worker();
      assert.equal(messages.length, count);
      assert.equal((await prisma.emailQueue.findUnique({ where: { id: 'notification:' + notice.id } })).error, 'RECIPIENT_OR_EVENT_NO_LONGER_ELIGIBLE');
    }
    checks.push('queued notice suppressed after suspension, unverified email, opt-out or address change; zero SMTP attempts');
    const applicant = await prisma.usuario.create({ data: { nombre: 'Pending QA', email: 'pending@qa.invalid', password: 'not-a-login', rol: 'GENERADOR', activo: false, motivoInactividad: 'PENDIENTE_APROBACION', emailVerified: true } });
    const application = await prisma.solicitudInscripcion.create({ data: { usuarioId: applicant.id, tipoActor: 'GENERADOR', estado: 'OBSERVADA', datosActor: '{}' } });
    const makeNotice = () => prisma.notificacion.create({ data: { usuarioId: applicant.id, tipo: 'SOLICITUD_OBSERVADA', titulo: 'QA', mensaje: 'No copiar texto', datos: JSON.stringify({ solicitudId: application.id }) } });
    const pendingBaseline = messages.length;
    const pendingNotice = await makeNotice();
    await worker();
    assert.equal(messages.length - pendingBaseline, 1);
    assert.equal((await prisma.emailQueue.findUnique({ where: { id: 'notification:' + pendingNotice.id } })).estado, 'ENVIADO');
    const later = await makeNotice();
    await queueCommittedNotificationEmails();
    await prisma.usuario.update({ where: { id: applicant.id }, data: { motivoInactividad: 'SUSPENDIDA' } });
    await worker();
    assert.equal(messages.length - pendingBaseline, 1);
    assert.equal((await prisma.emailQueue.findUnique({ where: { id: 'notification:' + later.id } })).estado, 'SUPRIMIDO');
    checks.push('verified pending applicant receives observation; suspension before delivery suppresses queued observation');
    const { recordAccountMail } = require('../dist/services/account-mail.service.js');
    process.env.EMAIL_NOTIFICATION_FAMILIES = 'cuentas';
    const accountRecipient = { id: 'synthetic-account', email: 'account-events@qa.invalid', emailVerified: true };
    const accountBaseline = messages.length;
    for (const event of ['created', 'enabled', 'disabled', 'deleted', 'roleChanged', 'emailChanged', 'passwordChanged']) {
      await prisma.$transaction((tx: typeof prisma) => recordAccountMail(tx, accountRecipient, event));
    }
    await assert.rejects(prisma.$transaction(async (tx: typeof prisma) => {
      await tx.usuario.update({ where: { id: user.id }, data: { nombre: 'must-roll-back' } });
      await recordAccountMail(tx, { ...accountRecipient, email: 'rollback-account@qa.invalid' }, 'created');
      throw new Error('account rollback');
    }), /account rollback/);
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).nombre, 'Mail QA');
    await Promise.all([worker(), worker()]);
    assert.equal(messages.length - accountBaseline, 7);
    assert.equal(await prisma.emailQueue.count({ where: { to: 'rollback-account@qa.invalid' } }), 0);
    await worker(); assert.equal(messages.length - accountBaseline, 7);
    checks.push('seven account templates accepted only by loopback SMTP, two workers once each, rolled-back account has no outbox');
    process.env.EMAIL_NOTIFICATION_FAMILIES = 'certificados,manifiestos,alertas';
    await prisma.usuario.update({ where: { id: user.id }, data: { activo: true, emailVerified: true, notifEmail: true, email: 'notices@qa.invalid' } });
    const common = { usuarioId: user.id, razonSocial: 'QA synthetic', cuit: '99-00000001-0', domicilio: 'QA', telefono: '0000', email: 'notices@qa.invalid', categoria: 'QA' };
    const generator = await prisma.generador.create({ data: { ...common, numeroInscripcion: 'QA' } });
    const operator = await prisma.operador.create({ data: { ...common, numeroHabilitacion: 'QA' } });
    const document = await prisma.documento.create({ data: { generadorId: generator.id, tipo: 'CERTIFICADO_AMBIENTAL', estado: 'APROBADO', nombre: 'QA.pdf', path: '/virtual/QA.pdf', mimeType: 'application/pdf', size: 10, subidoPor: user.id } });
    const certificateNotice = () => prisma.notificacion.create({ data: { usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: 'CAA QA', mensaje: 'No copiar datos', datos: JSON.stringify({ tipo: 'certificado_ambiental', documentoId: document.id, actorTipo: 'generador', actorId: generator.id }) } });
    const certificate = await certificateNotice();
    const manifest = await prisma.manifiesto.create({ data: { numero: 'QA-MAIL-001', generadorId: generator.id, operadorId: operator.id, creadoPorId: user.id, estado: 'APROBADO' } });
    const { notificationService } = require('../dist/services/notification-dispatcher.service.js');
    const operationalBaseline = messages.length;
    const manifestNotice = await notificationService.crearNotificacion({ usuarioId: user.id, tipo: 'MANIFIESTO_FIRMADO', titulo: 'QA', mensaje: 'QA', manifiestoId: manifest.id });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(messages.length, operationalBaseline, 'dispatcher must not bypass the outbox');
    await Promise.all([worker(), worker()]);
    assert.equal(messages.length - operationalBaseline, 2);
    for (const notice of [certificate, manifestNotice]) assert.equal((await prisma.emailQueue.findUniqueOrThrow({ where: { id: 'notification:' + notice.id } })).estado, 'ENVIADO');
    await worker(); assert.equal(messages.length - operationalBaseline, 2);
    checks.push('CAA and real manifest dispatcher relay once under two workers; no parallel legacy digest');
    const withdrawn = await certificateNotice();
    await queueCommittedNotificationEmails();
    await prisma.documento.update({ where: { id: document.id }, data: { estado: 'RECHAZADO' } });
    const demoNotice = await notificationService.crearNotificacion({ usuarioId: user.id, tipo: 'MANIFIESTO_FIRMADO', titulo: 'QA', mensaje: 'QA', manifiestoId: manifest.id });
    await prisma.manifiesto.update({ where: { id: manifest.id }, data: { isDemoData: true } });
    const rule = await prisma.reglaAlerta.create({ data: { nombre: 'QA vencimiento', evento: 'VENCIMIENTO', condicion: '{}', destinatarios: '["ADMIN"]', creadoPorId: user.id } });
    const alert = await prisma.alertaGenerada.create({ data: { reglaId: rule.id, datos: '{}' } });
    const alertNotice = await prisma.notificacion.create({ data: { usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: 'QA', mensaje: 'QA', datos: JSON.stringify({ familia: 'catalogo_verificable', casoId: alert.id }) } });
    await queueCommittedNotificationEmails();
    await prisma.alertaGenerada.update({ where: { id: alert.id }, data: { estado: 'RESUELTA' } });
    await worker(); assert.equal(messages.length - operationalBaseline, 2);
    for (const notice of [withdrawn, demoNotice, alertNotice]) assert.equal((await prisma.emailQueue.findUniqueOrThrow({ where: { id: 'notification:' + notice.id } })).estado, 'SUPRIMIDO');
    checks.push('withdrawn CAA, synthetic manifest and resolved expiry case suppressed before SMTP');
    const currentAlert = await prisma.alertaGenerada.create({ data: { reglaId: rule.id, datos: '{}' } });
    await prisma.notificacion.create({ data: { usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: 'QA', mensaje: 'QA', datos: JSON.stringify({ familia: 'catalogo_verificable', casoId: currentAlert.id }) } });
    await worker();
    assert.equal(messages.length - operationalBaseline, 3);
    checks.push('current enabled catalogue case delivered once through the verified recipient relay');
    process.env.EMAIL_NOTIFICATION_FAMILIES = 'padron';
    const { notifyRenovacion } = require('../dist/services/renovacion-notification.service.js');
    const renewalBaseline = messages.length;
    for (const [year, estado, tipo] of [[2091, 'PENDIENTE', 'MODIFICACION_SOLICITADA'], [2092, 'APROBADA', 'MODIFICACION_APROBADA'], [2093, 'RECHAZADA', 'MODIFICACION_RECHAZADA']]) {
      await prisma.$transaction(async (tx: typeof prisma) => {
        const renewal = await tx.renovacion.create({ data: { anio: year, tipoActor: 'GENERADOR', generadorId: generator.id, modalidad: 'SIN_CAMBIOS', estado, motivoRechazo: 'Texto sólo dentro de SITREP' } });
        await notifyRenovacion(tx, renewal, tipo);
      });
      await Promise.all([worker(), worker()]);
    }
    assert.equal(messages.length - renewalBaseline, 3);
    await worker(); assert.equal(messages.length - renewalBaseline, 3);
    assert.ok(messages.slice(renewalBaseline).every(message => !message.includes('Texto sólo dentro')));
    checks.push('renewal requested/approved/rejected transactional notices reach only eligible recipients, once, with no decision text in email');
    // Reproduce a busy inbox using real persisted receipts, not a mocked count.
    process.env.EMAIL_DAILY_LIMIT_TRANSACCIONAL = '1';
    process.env.EMAIL_NOTIFICATION_FAMILIES = 'soporte';
    const quotaUser = await prisma.usuario.create({ data: { nombre: 'Quota QA', email: 'quota@qa.invalid', password: 'not-a-login', rol: 'ADMIN', activo: true, emailVerified: true } });
    await prisma.emailQueue.create({ data: { id: 'notification:quota-already-sent', to: quotaUser.email, subject: 'QA receipt', html: '<p>QA</p>', tipo: 'TRANSACCIONAL', estado: 'ENVIADO', sentAt: new Date() } });
    const quotaBaseline = messages.length;
    const quotaService = reload();
    await quotaService.emailService.sendPasswordResetEmail(quotaUser.email, 'QA', 'synthetic-token');
    assert.equal(messages.length, quotaBaseline + 1, 'operational quota must not starve recovery');
    await quotaService.emailService.sendPasswordResetEmail(quotaUser.email, 'QA', 'synthetic-token');
    assert.equal(messages.length, quotaBaseline + 1, 'security quota remains enforced');
    const cappedNotice = await prisma.notificacion.create({ data: { usuarioId: quotaUser.id, tipo: 'INFO_GENERAL', titulo: 'QA', mensaje: 'QA', datos: JSON.stringify({ tipo: 'soporte', ticketId: 'qa-ticket' }) } });
    await worker();
    assert.equal(messages.length, quotaBaseline + 1, 'operational quota remains enforced');
    assert.equal((await prisma.emailQueue.findUniqueOrThrow({ where: { id: 'notification:' + cappedNotice.id } })).estado, 'SUPRIMIDO');
    checks.push('operational quota cannot starve password recovery; independent security and operational limits both enforced');
    process.env.EMAIL_EXTERNAL_ALERTS_ALLOWLIST = 'approved-external@qa.invalid';
    const externalBaseline = messages.length;
    await quotaService.emailService.sendAlertEmail(['unapproved@qa.invalid', 'approved-external@qa.invalid', ' APPROVED-EXTERNAL@qa.invalid '], { nombre: 'QA autorización individual' }, null, {});
    assert.equal((await prisma.emailQueue.findFirstOrThrow({ where: { to: 'unapproved@qa.invalid' } })).estado, 'SUPRIMIDO');
    await worker();
    assert.equal(messages.length, externalBaseline + 1);
    assert.equal(await prisma.emailQueue.count({ where: { to: 'approved-external@qa.invalid' } }), 1);
    checks.push('external recipients require exact individual approval; duplicate casing coalesces and unapproved address is terminal without SMTP');
    await quotaService.emailService.sendAlertEmail(['approved-external@qa.invalid'], { nombre: 'QA revocación antes del envío' }, null, {});
    process.env.EMAIL_EXTERNAL_ALERTS_ALLOWLIST = '';
    await worker();
    assert.equal(messages.length, externalBaseline + 1);
    assert.equal(await prisma.emailQueue.count({ where: { to: 'approved-external@qa.invalid', estado: 'SUPRIMIDO', error: 'EXTERNAL_RECIPIENT_NOT_AUTHORIZED' } }), 1);
    process.env.EMAIL_EXTERNAL_ALERTS_ALLOWLIST = 'approved-external@qa.invalid';
    await worker(); assert.equal(messages.length, externalBaseline + 1);
    checks.push('individual external approval is rechecked at delivery; revoked queued digest is suppressed and not replayed by reapproval');
    await quotaService.emailService.sendAlertEmail(['approved-external@qa.invalid'], { nombre: 'QA registered after enqueue' }, null, {});
    await prisma.usuario.create({ data: { nombre: 'QA no bypass', email: 'approved-external@qa.invalid', password: 'not-a-login', rol: 'GENERADOR', activo: false, motivoInactividad: 'SUSPENDIDA', emailVerified: false, notifEmail: false } });
    await worker(); assert.equal(messages.length, externalBaseline + 1);
    await quotaService.emailService.sendAlertEmail(['approved-external@qa.invalid'], { nombre: 'QA registered before enqueue' }, null, {});
    assert.equal(await prisma.emailQueue.count({ where: { to: 'approved-external@qa.invalid', estado: 'SUPRIMIDO', error: 'EXTERNAL_RECIPIENT_NOT_AUTHORIZED' } }), 3);
    checks.push('external channel cannot bypass a registered account: suspension, verification and preference gates remain under the user relay, including registration after enqueue');
    writeFileSync('/tmp/sitrep-mail-integration.json', JSON.stringify({ passed: true, checks, smtpMessages: messages.length, externalRecipients: 0, database: url.pathname, deployment: false }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, smtpMessages: messages.length }));
  } finally {
    await prisma.$disconnect();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => smtp.close(() => resolve()));
  }
}
