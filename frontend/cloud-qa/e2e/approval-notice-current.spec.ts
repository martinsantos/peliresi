import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from '../safety';
import { qaBackendEntry } from '../rollback-backend';
import { login, nonObstructingNotices, prefix } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });
test('an older approval stays accurate in the live notice, bell, inbox, detail and rendered mail', async ({ page }, info) => {
  if (info.project.name === 'app') await page.setViewportSize({ width: 320, height: 700 });
  const previous = '/work/sitrep/.qa-operational-ui-current2026103090/manifest-complete';
  const proofs = readdirSync(previous, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => path.join(previous, entry.name, 'complete-lifecycle.json')).filter(existsSync)
    .map(file => JSON.parse(readFileSync(file, 'utf8')));
  const proof = proofs.find(item => item.surface === info.project.name && item.creator === 'generador');
  expect(proof).toBeTruthy();
  const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
  try {
    const manifest = await db.manifiesto.findUniqueOrThrow({ where: { id: proof.id }, include: {
      generador: { include: { usuario: true } }, transportista: { include: { usuario: true } },
    } });
    expect(manifest.isDemoData).toBe(true);
    expect(manifest.numero).toBe(proof.numero);
    expect(manifest.estado).toBe('TRATADO');
    expect(manifest.generador.razonSocial).toMatch(/^QA /);
    expect(manifest.generador.usuario.email).toBe('generador@night-qa.invalid');
    expect(manifest.transportista.razonSocial).toMatch(/^QA /);
    await login(page, info, 'generador');
    const initialized = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/notificaciones' && url.searchParams.get('leida') === 'false' && response.status() === 200;
    });
    await page.reload(); await initialized;
    await page.waitForTimeout(500);
    const original = `${manifest.numero}. Revisá qué aprobaciones faltan.`;
    const notice = await db.notificacion.create({ data: {
      id: randomUUID(), usuarioId: manifest.generador.usuarioId, tipo: 'INFO_GENERAL', prioridad: 'NORMAL',
      titulo: 'Transporte aprobó su participación', mensaje: original, manifiestoId: manifest.id,
      datos: JSON.stringify({ tipo: 'propuesta_partes', version: 1, fase: 'aprobacion-TRANSPORTISTA',
        autorId: manifest.transportista.usuarioId, url: `/manifiestos/${manifest.id}` }),
    } });
    const expected = `${manifest.numero}. Consultá el estado actual de las aprobaciones.`;
    const live = page.locator('[data-linked-notice="true"]').filter({ hasText: manifest.numero });
    await expect(live).toContainText(expected, { timeout: 35_000 });
    await nonObstructingNotices(page);
    await page.screenshot({ path: info.outputPath('aviso-en-vivo.png'), animations: 'disabled', scale: 'css' });
    await page.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).first().click();
    const bell = page.getByRole('region', { name: 'Notificaciones recientes', exact: true });
    await expect(bell.getByRole('button').filter({ hasText: manifest.numero })).toContainText(expected);
    await page.getByRole('button', { name: 'Cerrar notificaciones', exact: true }).click();
    await page.goto(`${prefix(info)}/notificaciones`);
    const inbox = page.getByRole('list', { name: 'Avisos', exact: true }).getByRole('listitem').filter({ hasText: manifest.numero });
    await expect(inbox.filter({ hasText: expected }).first()).toBeVisible();
    await page.goto(`${prefix(info)}/notificaciones/${notice.id}`);
    await expect(page.getByRole('article')).toContainText(expected);
    expect((await db.notificacion.findUniqueOrThrow({ where: { id: notice.id } })).mensaje).toBe(original);
    const { notificationMailContent } = backendRequire(path.join(path.dirname(qaBackendEntry()), 'services/notification-mail.service.js'));
    const mail = notificationMailContent({ ...manifest.generador.usuario, ...notice, rol: 'GENERADOR' });
    expect(mail).toBeTruthy();
    expect(mail.html).toContain('Consultá el estado actual de las aprobaciones');
    expect(mail.html).not.toContain('qué aprobaciones faltan');
    expect(mail.html).toContain(`/notificaciones/${notice.id}`);
    const email = await page.context().newPage();
    try {
      if (info.project.name === 'app') await email.setViewportSize({ width: 320, height: 700 });
      await email.route('**/*', route => route.abort());
      await email.setContent(mail.html);
      await expect(email.getByText(/Consultá el estado actual de las aprobaciones/)).toBeVisible();
      await email.screenshot({ path: info.outputPath('correo-renderizado.png'), animations: 'disabled', scale: 'css' });
    } finally { await email.close(); }
    expect(await db.emailQueue.count({ where: { intentos: { gt: 0 } } })).toBe(0);
    expect(await db.emailQueue.count({ where: { sentAt: { not: null } } })).toBe(0);
    writeFileSync(info.outputPath('approval-notice-proof.json'), JSON.stringify({ surface: info.project.name,
      synthetic: true, production: false, historicalRecordUnchanged: true, live: true, bell: true, inbox: true,
      detail: true, mailRenderedWithoutSending: true, mailLinkToOwnedNotice: true }, null, 2), { flag: 'wx', mode: 0o600 });
  } finally { await db.$disconnect(); }
});
