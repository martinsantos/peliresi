/** Real HTTP mutations and outbox assertions, exclusively in the isolated cloud DB. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const { PrismaClient } = backendRequire('@prisma/client');
const db = new PrismaClient();
const api = 'http://127.0.0.1:3037/api';
const password = 'OnlyLocal-NightQA-2026!';
async function request(route: string, method: string, body?: unknown, token?: string, expected = 200) {
  const response = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
  return result;
}
const checks: string[] = [];
try {
  const admin = await request('/auth/login', 'POST', { email: 'admin@night-qa.invalid', password });
  const token = admin.data.tokens.accessToken;
  assert.ok(token);
  const email = 'account-lifecycle@night-qa.invalid', nextEmail = 'account-changed@night-qa.invalid';
  const created = await request('/admin/usuarios', 'POST', { email, password, nombre: 'QA Account Lifecycle', rol: 'GENERADOR', activo: true, emailVerified: true }, token, 201);
  const id = created.data.usuario.id;
  const mails = () => db.emailQueue.findMany({ where: { to: { in: [email, nextEmail] }, id: { startsWith: 'account:' } }, orderBy: { createdAt: 'asc' } });
  assert.equal((await mails()).length, 1);
  await request('/admin/usuarios/' + id, 'PUT', { telefono: '0000000000' }, token);
  assert.equal((await mails()).length, 1);
  await request('/admin/usuarios/' + id, 'PUT', { email: nextEmail, rol: 'OPERADOR' }, token);
  assert.equal((await mails()).length, 3);
  assert.ok((await mails()).every((row: { to: string }) => row.to === email));
  checks.push('create emits one event; ordinary edit emits none; address and role notices use old verified address');
  for (const active of [false, true]) {
    const result = await request('/admin/usuarios/' + id + '/toggle-activo', 'PATCH', {}, token);
    assert.equal(result.data.usuario.activo, active);
  }
  assert.equal((await mails()).length, 5);
  const login = await request('/auth/login', 'POST', { email: nextEmail, password });
  const actorToken = login.data.tokens.accessToken;
  await request('/auth/change-password', 'POST', { currentPassword: 'incorrect', newPassword: 'New-NightQA-2026!' }, actorToken, 400);
  assert.equal((await mails()).length, 5);
  await request('/auth/change-password', 'POST', { currentPassword: password, newPassword: 'New-NightQA-2026!' }, actorToken);
  assert.equal((await mails()).length, 6);
  checks.push('deactivation/reactivation and authenticated password change persist their notices; wrong password emits none');
  const proof = 'synthetic-reset-proof-cloud-only';
  await db.usuario.update({ where: { id }, data: { passwordResetToken: createHash('sha256').update(proof).digest('hex'), passwordResetExpires: new Date(Date.now() + 60000) } });
  await request('/auth/reset-password', 'POST', { token: proof, newPassword: 'Reset-NightQA-2026!' });
  await request('/auth/reset-password', 'POST', { token: proof, newPassword: 'Reset-NightQA-2026!' }, undefined, 400);
  assert.equal((await mails()).length, 7);
  await request('/admin/usuarios/' + id, 'DELETE', undefined, token);
  assert.equal((await mails()).length, 8);
  checks.push('recovery proof consumed once; successful deletion leaves its outbox notice');
  assert.ok((await mails()).every((row: { estado: string; sentAt: unknown; html: string }) => row.estado === 'SUPRIMIDO' && row.sentAt === null && !row.html.includes(proof) && !row.html.includes(password)));
  assert.equal(await db.usuario.findUnique({ where: { id } }), null);
  checks.push('all eight messages terminal SUPRIMIDO, no secrets in content, no SMTP credentials or active delivery');
  const candidateEmail = 'pending-policy@night-qa.invalid';
  const registration = await request('/solicitudes/iniciar', 'POST', { email: candidateEmail, password, nombre: 'QA pending policy', cuit: '30711235961', tipoActor: 'GENERADOR' }, undefined, 201);
  const candidate = await db.usuario.findUniqueOrThrow({ where: { email: candidateEmail } });
  assert.equal(candidate.activo, false);
  assert.equal(candidate.motivoInactividad, 'PENDIENTE_APROBACION');
  await request('/auth/login', 'POST', { email: candidateEmail, password }, undefined, 403);
  // Synthetic verification proof in isolated QA; never a production user's session.
  const verificationProof = 'qa-pending-verification-proof';
  await db.usuario.update({ where: { id: candidate.id }, data: { emailVerificationToken: createHash('sha256').update(verificationProof).digest('hex') } });
  await request('/auth/verify-email?token=' + verificationProof, 'GET');
  const candidateLogin = await request('/auth/login', 'POST', { email: candidateEmail, password });
  assert.equal(candidateLogin.data.restricted, true);
  const candidateToken = candidateLogin.data.tokens.accessToken;
  await request('/solicitudes/' + registration.data.solicitudId, 'GET', undefined, candidateToken);
  // Fixture prerequisite only: actual review and observation use the HTTP API.
  await db.solicitudInscripcion.update({ where: { id: registration.data.solicitudId }, data: { estado: 'ENVIADA' } });
  await request('/solicitudes/' + registration.data.solicitudId + '/revisar', 'POST', {}, token);
  await request('/solicitudes/' + registration.data.solicitudId + '/observar', 'POST', { observaciones: 'QA completar domicilio declarado' }, token);
  const observation = await db.notificacion.findFirst({ where: { usuarioId: candidate.id, tipo: 'SOLICITUD_OBSERVADA' } });
  assert.equal(JSON.parse(observation.datos).solicitudId, registration.data.solicitudId);
  checks.push('real administrative review and observation emit a private applicant notice for the correct application');
  // Explicit suspension must also invalidate an already-issued restricted session.
  await request('/admin/usuarios/' + candidate.id, 'PUT', { activo: false }, token);
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: candidate.id } })).motivoInactividad, 'SUSPENDIDA');
  await request('/auth/login', 'POST', { email: candidateEmail, password }, undefined, 403);
  await request('/solicitudes/' + registration.data.solicitudId, 'GET', undefined, candidateToken, 401);
  await request('/auth/refresh-token', 'POST', { refreshToken: candidateLogin.data.tokens.refreshToken }, undefined, 401);
  checks.push('public applicant starts pending; verified login is restricted; explicit suspension denies login, existing session and refresh');
  await writeFile(path.join(process.env.QA_ARTIFACTS!, 'account-mail-http.json'), JSON.stringify({ passed: true, checks, smtpEnabled: false, database: 'sitrep_night_qa_20260926' }, null, 2));
} finally { await db.$disconnect(); }
