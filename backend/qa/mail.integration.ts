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
    writeFileSync('/tmp/sitrep-mail-integration.json', JSON.stringify({ passed: true, checks, smtpMessages: messages.length, externalRecipients: 0, database: url.pathname, deployment: false }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, smtpMessages: messages.length }));
  } finally {
    await prisma.$disconnect();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => smtp.close(() => resolve()));
  }
}
