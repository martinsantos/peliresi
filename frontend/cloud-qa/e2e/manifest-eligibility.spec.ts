import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix } from './helpers';

async function choose(page: Page, label: string, name: RegExp) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('option', { name }).click();
}

test('eligibility is explained before submission and stale account rejection recovers without losing the form', async ({ page }, info) => {
  await assertCloudDatabase();
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
  assert.equal(process.env.DISABLE_EMAILS, 'true');
  assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
  const fixture = JSON.parse(readFileSync(process.env.QA_ARTIFACTS! + '/fixture.json', 'utf8'));
  const { PrismaClient } = backendRequire('@prisma/client');
  const db = new PrismaClient();
  const namespace = 'eligibility-' + randomUUID();
  const rows: Array<{ id: string; usuarioId: string; razonSocial: string }> = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const sourceUser = await db.usuario.findUniqueOrThrow({ where: { id: fixture.users.operador } });
    const sourceActor = await db.operador.findUniqueOrThrow({ where: { id: fixture.actors.operador } });
    assert.match(sourceUser.email, /@night-qa\.invalid$/);
    const treatments = await db.tratamientoAutorizado.findMany({ where: { operadorId: sourceActor.id } });
    // Create dedicated artificial accounts; never alter shared fixture identities.
    for (const [index, active] of [false, true].entries()) {
      const id = namespace + '-' + index, usuarioId = id + '-user';
      const razonSocial = 'QA Elegibilidad ' + info.project.name + ' ' + index + ' ' + namespace.slice(-8);
      await db.usuario.create({ data: { ...sourceUser, id: usuarioId, email: id + '@night-qa.invalid', cuit: null,
        activo: active, nombre: razonSocial, notifEmail: false } });
      await db.operador.create({ data: { ...sourceActor, id, usuarioId, razonSocial, cuit: id,
        email: id + '@night-qa.invalid', activo: true } });
      for (const treatment of treatments) await db.tratamientoAutorizado.create({ data: {
        ...treatment, id: id + '-' + treatment.id, operadorId: id,
      } });
      rows.push({ id, usuarioId, razonSocial });
    }
    await login(page, info, 'admin');
    await page.goto(prefix(info) + '/manifiestos/nuevo');
    await choose(page, 'Generador *', /^QA Generador 1 /);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await choose(page, 'Tipo de Residuo *', /^Y1 - /);
    await page.getByLabel('Cantidad *', { exact: true }).fill('12.5');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await choose(page, 'Transportista *', /^QA Transporte 1 /);
    await choose(page, 'Operador / Destino *', new RegExp('^' + rows[0].razonSocial + ' '));
    const explanation = 'Operador «' + rows[0].razonSocial + '»: su cuenta de acceso está inactiva.';
    await expect(page.getByText(explanation, { exact: false })).toBeVisible();
    const observations = 'QA elegibilidad: conservar cantidad y observaciones ' + info.project.name;
    await page.getByLabel('Observaciones', { exact: true }).fill(observations);
    const writes: string[] = [];
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/manifiestos')) writes.push(request.url()); });
    await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Operador / Destino *', exact: true })).toBeFocused();
    expect(writes).toHaveLength(0);
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(observations);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('account-inactive.png'), animations: 'disabled' });

    await choose(page, 'Operador / Destino *', new RegExp('^' + rows[1].razonSocial + ' '));
    // Simulate a legitimate account state change after the real catalog was read.
    assert.ok(rows[1].usuarioId.startsWith(namespace));
    await db.usuario.update({ where: { id: rows[1].usuarioId }, data: { activo: false } });
    const before = await db.manifiesto.count({ where: { operadorId: rows[1].id } });
    const rejected = page.waitForResponse(r => r.url().endsWith('/api/manifiestos') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
    const response = await rejected;
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.operador).toContain(rows[1].razonSocial);
    expect(body.fieldErrors.operador).toContain('cuenta de acceso está inactiva');
    expect(await db.manifiesto.count({ where: { operadorId: rows[1].id } })).toBe(before);
    await expect(page.getByRole('button', { name: 'Operador / Destino *', exact: true })).toBeFocused();
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(observations);
    await page.screenshot({ path: info.outputPath('server-rejection.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
    expect(writes).toHaveLength(1);

    await db.usuario.update({ where: { id: rows[1].usuarioId }, data: { activo: true } });
    await page.getByRole('button', { name: 'Actualizar estados', exact: true }).click();
    await expect(page.getByText('Revisá las partes antes de crear', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Transportista *', exact: true })).toContainText('QA Transporte 1');
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveValue(observations);
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await expect(page.getByLabel('Cantidad *', { exact: true })).toHaveValue('12.5');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    const created = page.waitForResponse(r => r.url().endsWith('/api/manifiestos') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
    const accepted = await created;
    expect(accepted.status()).toBe(201);
    const manifest = (await accepted.json()).data.manifiesto;
    expect(manifest.estado).toBe('PENDIENTE_APROBACION');
    await expect(page.getByRole('region', { name: 'Aprobaciones de las partes' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('recovered-proposal.png'), animations: 'disabled' });
    await page.goto(prefix(info) + '/manifiestos/nuevo');
    await expect(page.getByRole('button', { name: 'Generador *', exact: true })).toBeVisible();
    await expect(page.getByText('Borrador recuperado · guardado en este dispositivo')).toHaveCount(0);
    await expect(page.getByLabel('Observaciones', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('evidence.json'), JSON.stringify({ namespace, project: info.project.name,
      rejectedWithoutInsert: true, recoveredWithoutLostFields: true, manifestId: manifest.id,
      externalDelivery: false, capClosed: true, errors }, null, 2));
  } finally {
    // Leave the test-only account active for inspection; no shared accounts changed.
    if (rows[1]) await db.usuario.update({ where: { id: rows[1].usuarioId }, data: { activo: true } });
    await db.$disconnect();
  }
});
