import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-support-mail-20261031';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.QA_COMPAT_BACKEND, 'support-mail-20261031');
assert.equal(process.env.GITHUB_SHA, 'a624b232bc3ca48a2f7e8582e8051170372070ed');
assert.equal(process.env.EMAIL_NOTIFICATION_FAMILIES, '');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client');
const { notificationSourceEligible } = backendRequire('/work/sitrep/backend/dist-qa-support-mail-20261031/services/notification-mail.service.js');
const db = new PrismaClient();
try {
  const ticket = await db.ticketSoporte.findFirstOrThrow({ where: { asunto: 'QA circuito completo app' }, orderBy: { createdAt: 'desc' },
    select: { id: true, autor: { select: { id: true, email: true, rol: true, activo: true } },
      responsable: { select: { id: true, email: true, rol: true, activo: true, agenteSoporte: { select: { habilitado: true } } } } } });
  const admin = await db.usuario.findUniqueOrThrow({ where: { email: 'admin@night-qa.invalid' }, select: { id: true, email: true, rol: true, activo: true } });
  const outsider = await db.usuario.findUniqueOrThrow({ where: { email: 'transportista@night-qa.invalid' },
    select: { id: true, email: true, rol: true, activo: true, agenteSoporte: { select: { habilitado: true } } } });
  const agent = ticket.responsable;
  assert.ok(agent?.agenteSoporte?.habilitado);
  assert.notEqual(outsider.id, ticket.autor.id);
  assert.ok(!outsider.agenteSoporte?.habilitado);
  for (const user of [ticket.autor, agent, admin, outsider]) assert.match(user.email, /@night-qa\.invalid$/);
  const notice = (user: { id: string; email: string; rol: string; activo: boolean }, ticketId = ticket.id) => ({
    id: 'synthetic-support-notice', usuarioId: user.id, email: user.email, rol: user.rol, activo: user.activo,
    emailVerified: true, notifEmail: true, tipo: 'INFO_GENERAL', createdAt: new Date(),
    datos: JSON.stringify({ tipo: 'soporte', evento: 'REABRIR', ticketId }),
  });
  assert.equal(await notificationSourceEligible(notice(ticket.autor), 'soporte'), true);
  assert.equal(await notificationSourceEligible(notice(admin), 'soporte'), true);
  assert.equal(await notificationSourceEligible(notice(agent), 'soporte'), true);
  assert.equal(await notificationSourceEligible(notice(outsider), 'soporte'), false);
  assert.equal(await notificationSourceEligible(notice(admin, 'missing-synthetic-ticket'), 'soporte'), false);
  try {
    await db.agenteSoporte.update({ where: { usuarioId: agent.id }, data: { habilitado: false } });
    assert.equal(await notificationSourceEligible(notice(agent), 'soporte'), false);
  } finally {
    await db.agenteSoporte.update({ where: { usuarioId: agent.id }, data: { habilitado: true } });
  }
  assert.equal(await notificationSourceEligible(notice(agent), 'soporte'), true);
  const result = { synthetic: true, owner: true, administrator: true, agent: true, unrelated: false,
    missingTicket: false, revokedAgent: false, restoredAgent: true, externalDelivery: false };
  writeFileSync(`${out}/mail-access-integration.json`, JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
