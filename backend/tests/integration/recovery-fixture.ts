import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assertNightDatabase } from './seed-night';

export const recoveryApi = 'http://127.0.0.1:3037/api';
export async function recoveryDatabase() {
  assertNightDatabase();
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/sitrep_night_qa_20260926');
  const pids = [...new Set(execFileSync('lsof', ['-t', '-iTCP:3037', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split(/\s+/))];
  assert.equal(pids.length, 1);
  const runtime = execFileSync('ps', ['eww', '-p', pids[0], '-o', 'command='], { encoding: 'utf8' });
  for (const flag of ['DATABASE_URL=postgresql://santosma@127.0.0.1:55440/sitrep_night_qa_20260926?schema=public',
    'NODE_ENV=test', 'DISABLE_EMAILS=true', 'BLOCKCHAIN_ENABLED=false']) assert.ok(runtime.includes(flag), flag.split('=')[0]);
  for (const flag of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
    assert.match(runtime, new RegExp('(?:^|\\s)' + flag + '=\\s'), flag);
  }
  const db = new PrismaClient();
  const actual = await db.$queryRaw<Array<{ name: string; port: number }>>`SELECT current_database() AS name, inet_server_port() AS port`;
  assert.deepEqual(actual, [{ name: 'sitrep_night_qa_20260926', port: 55440 }]);
  return db;
}

export async function createRecoveryFixture(db: PrismaClient, domain = 'night-qa.invalid') {
  const id = 'qa-recovery-' + randomUUID();
  const password = 'OnlyLocal-Recovery-2026!';
  return { password, user: await db.usuario.create({ data: {
    id, email: id + '@' + domain, cuit: '98-' + randomInt(10000000, 99999999) + '-0',
    nombre: 'QA recuperación', empresa: 'Entidad QA recuperación', password: await bcrypt.hash(password, 10),
    rol: 'GENERADOR', activo: true, emailVerified: true, notifEmail: false,
    notifNuevoRegistro: false, notifWhatsapp: false, notifTelegram: false,
  } }) };
}

// Read only the isolated synthetic queue, never a user's inbox. DISABLE_EMAILS
// prevents SMTP. Existing queue ENVIADO labels are not evidence of delivery.
export async function recoveryToken(db: PrismaClient, email: string) {
  assert.ok(email.endsWith('@night-qa.invalid'));
  const message = await db.emailQueue.findFirstOrThrow({ where: { to: email }, orderBy: { createdAt: 'desc' } });
  const token = /reset-password\?token=([a-f0-9]{64})/.exec(message.html)?.[1];
  assert.ok(token, 'Stored-mailbox recovery link must exist in the synthetic queue');
  return token;
}
