import { expect, test } from '@playwright/test';
import { login, prefix } from './helpers';

test('real manifest UI completes approval, transport, receipt, treatment and certificate', async ({ page }, info) => {
  await login(page, info);
  await page.goto(`${prefix(info)}/manifiestos/nuevo`);
  const choose = async (label: string, value: RegExp) => {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('option', { name: value }).click();
  };
  await choose('Generador *', /^QA Generador 1 /);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose('Tipo de Residuo *', /^Y1 - /);
  await page.getByLabel('Cantidad *', { exact: true }).fill('35');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await choose('Transportista *', /^QA Transporte 1 /);
  await choose('Operador / Destino *', /^QA Operador 1 /);
  const created = page.waitForResponse(res => res.url().endsWith('/api/manifiestos') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear Manifiesto', exact: true }).click();
  const createdResponse = await created;
  expect(createdResponse.status()).toBe(201);
  const record = (await createdResponse.json()).data.manifiesto;
  await page.goto(`${prefix(info)}/manifiestos/${record.id}`);
  const primary = page.getByRole('button', { name: 'Firmar Manifiesto', exact: true });
  const infoHeading = page.getByRole('heading', { name: 'Información general', exact: true });
  await expect(primary).toBeVisible();
  expect((await primary.boundingBox())!.y).toBeLessThan((await infoHeading.boundingBox())!.y);
  await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Firmar Manifiesto', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Firma del manifiesto', exact: true });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: info.outputPath('manifest-signature-dialog.png'), animations: 'disabled' });
  const canvas = dialog.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  const useSignature = dialog.getByRole('button', { name: 'Usar firma', exact: true });
  const approveSignature = dialog.getByRole('button', { name: 'Confirmar y Firmar', exact: true });
  const hasInk = () => canvas.evaluate((node: HTMLCanvasElement) => {
    const pixels = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] && pixels[index] < 240 && pixels[index + 1] < 240 && pixels[index + 2] < 240) return true;
    }
    return false;
  });
  await expect(useSignature).toBeDisabled();
  await page.mouse.click(bounds.x + bounds.width * .1, bounds.y + bounds.height * .6);
  await expect(useSignature).toBeDisabled();
  await expect(approveSignature).toBeDisabled();
  // A real touch with no movement must also leave capture disabled on phones.
  if (info.project.name !== 'web-desktop') {
    await canvas.tap({ position: { x: bounds.width * .2, y: bounds.height * .5 } });
    await expect(useSignature).toBeDisabled();
    await expect(approveSignature).toBeDisabled();
  }
  expect(await hasInk()).toBe(false);
  await page.mouse.move(bounds.x + bounds.width * .1, bounds.y + bounds.height * .6);
  await page.mouse.down();
  for (const [x, y] of [[.25, .3], [.4, .6], [.5, .2], [.7, .7], [.85, .4]]) {
    await page.mouse.move(bounds.x + bounds.width * x, bounds.y + bounds.height * y, { steps: 5 });
  }
  await page.mouse.up();
  expect(await hasInk()).toBe(true);
  await expect(useSignature).toBeEnabled();
  await expect(approveSignature).toBeDisabled();
  await useSignature.click();
  await expect(dialog.getByRole('img', { name: 'Firma', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('manifest-signature-prepared.png'), animations: 'disabled' });
  const signed = page.waitForResponse(res => res.url().endsWith(`/api/manifiestos/${record.id}/firmar`) && res.request().method() === 'POST');
  await approveSignature.click();
  const signedResponse = await signed;
  expect(signedResponse.request().postDataJSON().firma).toMatch(/^data:image\/png;base64,/);
  expect(signedResponse.status()).toBe(200);
  await expect(dialog).not.toBeVisible();
  for (const [button, endpoint] of [
    ['Confirmar Retiro', 'confirmar-retiro'], ['Confirmar Entrega', 'confirmar-entrega'], ['Confirmar Recepcion', 'confirmar-recepcion'],
  ]) {
    const changed = page.waitForResponse(res => res.url().endsWith(`/api/manifiestos/${record.id}/${endpoint}`) && res.request().method() === 'POST');
    await page.getByRole('button', { name: button, exact: true }).click();
    expect((await changed).status()).toBe(200);
  }
  await page.getByRole('button', { name: 'Registrar Tratamiento', exact: true }).click();
  const treatmentDialog = page.getByRole('dialog', { name: 'Registrar Tratamiento', exact: true });
  const observation = treatmentDialog.getByPlaceholder('Observaciones del tratamiento...');
  await observation.fill('QA tratamiento: conservar este texto si se pierde la conexión.');
  await page.context().setOffline(true);
  await treatmentDialog.getByRole('button', { name: 'Confirmar Tratamiento', exact: true }).click();
  await expect(page.getByText(/Network Error|No se pudo conectar|Error de conexión/).first()).toBeVisible();
  await expect(treatmentDialog).toBeVisible();
  await expect(observation).toHaveValue('QA tratamiento: conservar este texto si se pierde la conexión.');
  await page.context().setOffline(false);
  const treated = page.waitForResponse(res => res.url().endsWith(`/api/manifiestos/${record.id}/tratamiento`) && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar Tratamiento', exact: true }).click();
  expect((await treated).status()).toBe(200);
  const closed = page.waitForResponse(res => res.url().endsWith(`/api/manifiestos/${record.id}/cerrar`) && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Cerrar Manifiesto', exact: true }).click();
  expect((await closed).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Descargar Certificado', exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar Certificado', exact: true }).click();
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  await download.saveAs(info.outputPath('manifest-certificate.pdf'));
  await page.screenshot({ path: info.outputPath('manifest-completed.png'), animations: 'disabled' });
});
