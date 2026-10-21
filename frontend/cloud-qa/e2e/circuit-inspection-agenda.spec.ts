import { expect, test, type Page } from '@playwright/test';
import { login, prefix, readableWholeWords } from './helpers';

async function api(page: Page, path: string) {
  return page.evaluate(async path => {
    const r = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + localStorage.getItem('sitrep_access_token') } });
    return { status: r.status, body: await r.json() };
  }, path);
}

test('inspection agenda changes reach the current inspector and competent administration, not the actor', async ({ page, browser }, info) => {
  page.setDefaultTimeout(15_000);
  const contexts = [], errors: string[] = [];
  const asUser = async (user: string) => {
    const context = await browser.newContext({ viewport: page.viewportSize(), baseURL: 'http://127.0.0.1:4177', serviceWorkers: 'block' });
    contexts.push(context); const target = await context.newPage(); target.setDefaultTimeout(15_000);
    target.on('pageerror', e => errors.push(e.message)); await login(target, info, user); return target;
  };
  try {
    await login(page, info); const inspector = await asUser('inspector'), admin = await asUser('lector-generadores');
    await page.goto(prefix(info) + '/inspecciones');
    await page.getByRole('button', { name: 'Nueva inspección', exact: true }).click();
    await page.getByRole('combobox', { name: 'Tipo de inspección', exact: true }).selectOption('GENERADOR');
    const actors = page.getByRole('combobox', { name: 'Actor inspeccionado', exact: true });
    await actors.selectOption({ label: 'QA Generador 1' });
    const team = page.getByRole('combobox', { name: 'Inspector asignado', exact: true });
    await team.selectOption({ label: 'QA inspector' });
    await page.getByLabel('Fecha programada', { exact: true }).fill('2030-01-03T10:00');
    const created = page.waitForResponse(r => r.url().endsWith('/api/inspecciones') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear expediente', exact: true }).click();
    const response = await created; expect(response.status()).toBe(201); const record = (await response.json()).data;
    const notices = async (target: Page, evento: string) => {
      const result = await api(target, '/notificaciones?limit=500'); expect(result.status).toBe(200);
      return result.body.data.notificaciones.filter((row: { datos: string }) => {
        const data = JSON.parse(row.datos || '{}'); return data.inspeccionId === record.id && data.tipo === 'agenda_inspeccion' && data.evento === evento;
      });
    };
    const openNotice = async (target: Page, evento: string) => {
      const rows = await notices(target, evento); expect(rows).toHaveLength(1);
      expect(rows[0].leida).toBe(false); expect(JSON.parse(rows[0].datos)).toMatchObject({ correoVersion: 1, destino: 'inspeccion' });
      await target.getByRole('button', { name: /^Notificaciones(?: \(|$)/ }).click();
      const panel = target.getByRole('region', { name: 'Notificaciones recientes', exact: true });
      const action = panel.getByRole('button').filter({ has: target.getByText(rows[0].titulo, { exact: true }) }).filter({ hasText: record.numero });
      await readableWholeWords(action.getByText(rows[0].titulo, { exact: true }));
      await target.screenshot({ path: info.outputPath(`agenda-${evento}-${target === admin ? 'admin' : 'inspector'}.png`), animations: 'disabled' });
      await action.click(); await expect(target).toHaveURL(`http://127.0.0.1:4177${prefix(info)}/inspecciones/${record.id}`);
      await expect.poll(async () => (await notices(target, evento))[0].leida).toBe(true);
    };
    await openNotice(inspector, 'PROGRAMADA'); await openNotice(admin, 'PROGRAMADA');
    const organize = async (date: string | null, inspectorName?: string) => {
      await page.goto(`${prefix(info)}/inspecciones/${record.id}`);
      await page.getByRole('button', { name: 'Organizar visita y asignación', exact: true }).click();
      if (date !== null) { await page.getByLabel('Cambiar fecha programada').check(); await page.getByLabel('Nueva fecha de inspección').fill(date); }
      if (inspectorName) await page.getByRole('combobox', { name: 'Inspector asignado', exact: true }).selectOption({ label: inspectorName });
      await page.getByLabel('Motivo del cambio').fill('QA artificial: reorganización de agenda documentada.');
      const saved = page.waitForResponse(r => r.url().endsWith(`/api/inspecciones/${record.id}/organizacion`) && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: 'Confirmar organización', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByRole('button', { name: 'Confirmar organización', exact: true })).not.toBeVisible();
    };
    await organize('2030-01-04T10:00'); await openNotice(inspector, 'REPROGRAMADA'); await openNotice(admin, 'REPROGRAMADA');
    // Repeating the same date persists its explanation, but is not another agenda change.
    await organize('2030-01-04T10:00'); expect(await notices(inspector, 'REPROGRAMADA')).toHaveLength(1);
    await organize(''); await openNotice(inspector, 'AGENDA_RETIRADA'); await openNotice(admin, 'AGENDA_RETIRADA');
    await organize(null, 'QA inspector2'); const replacement = await asUser('inspector2');
    await openNotice(replacement, 'REASIGNADA'); await openNotice(admin, 'REASIGNADA');
    expect(await notices(inspector, 'REASIGNADA')).toHaveLength(0);
    expect((await api(inspector, `/inspecciones/${record.id}`)).status).toBe(403);
    await inspector.close(); await admin.close(); await replacement.close();
    for (const role of ['generador', 'lector-operadores']) {
      const unrelated = await asUser(role);
      for (const event of ['PROGRAMADA', 'REPROGRAMADA', 'AGENDA_RETIRADA', 'REASIGNADA']) {
        expect(await notices(unrelated, event)).toHaveLength(0); expect(await notices(page, event)).toHaveLength(0);
      }
      await unrelated.close();
    }
    expect(errors).toEqual([]);
    await info.attach('agenda-contract', { body: JSON.stringify({ id: record.id, source: 'real UI and API', projects: info.project.name, recipients: ['current inspector', 'competent administration'], noExternalDelivery: true }), contentType: 'application/json' });
  } finally { for (const context of contexts) await context.close(); }
});
