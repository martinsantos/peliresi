import { test, expect } from '@playwright/test';

test('la portada y el acceso conservan la identidad azul y los tres recorridos de alta', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sistema de Trazabilidad de Residuos Peligrosos' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Mendoza — Gobierno de la Provincia/ }).first()).toBeVisible();
  for (const actor of ['Generador', 'Transportista', 'Operador']) {
    await expect(page.getByRole('link', { name: `Iniciar alta de ${actor}` })).toHaveAttribute('href', `/inscripcion/${actor.toLowerCase()}`);
    await expect(page.getByRole('link', { name: `Probar formulario de ${actor} sin completar datos` })).toHaveAttribute('href', `/inscripcion/${actor.toLowerCase()}?modo=revision`);
  }
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('img', { name: /Mendoza — Gobierno de la Provincia/ }).first()).toBeVisible();
  const actionColor = await page.getByRole('button', { name: 'Ingresar' }).evaluate(element => getComputedStyle(element).backgroundColor);
  expect(actionColor).toBe('rgb(8, 17, 160)');
});

for (const actor of ['generador', 'transportista', 'operador']) {
  test(`revisión ${actor}: pasos completos sin escrituras ni correos`, async ({ page }) => {
    const writes: string[] = [];
    page.on('request', request => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
    });
    await page.goto(`/inscripcion/${actor}?modo=revision`);
    await expect(page.getByTestId('registration-wizard')).toBeVisible();
    await expect(page.getByText('Modo revisión de alta.')).toBeVisible();
    const stepCount = actor === 'generador' ? 7 : actor === 'operador' ? 8 : 5;
    for (let step = 1; step < stepCount; step++) {
      await expect(page.getByText(`Paso ${step} de ${stepCount}`, { exact: false }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    await page.getByRole('button', { name: 'Finalizar revisión' }).click();
    await expect(page.getByRole('heading', { name: 'Revisión finalizada' })).toBeVisible();
    expect(writes).toEqual([]);
  });
}

test('alta real simulada: la sesión limitada guarda y recupera el borrador sin correos', async ({ page }) => {
  const savedForms: Record<string, string>[] = [];
  await page.route('**/api/solicitudes/iniciar', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { solicitudId: 'draft-qa', tokens: { accessToken: 'limited-test-token', refreshToken: 'limited-test-refresh' } } }),
  }));
  await page.route('**/api/solicitudes/draft-qa', async route => {
    if (route.request().method() === 'PUT') {
      savedForms.push(route.request().postDataJSON().datosActor);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { solicitud: {
      tipoActor: 'GENERADOR', estado: 'BORRADOR', datosActor: JSON.stringify(savedForms.at(-1)),
      usuario: { nombre: 'Usuario QA', email: 'qa@example.invalid', cuit: '30-12345678-9' },
    } } }) });
  });

  await page.goto('/inscripcion/generador');
  await page.getByPlaceholder('Juan Perez').fill('Usuario QA');
  await page.getByPlaceholder('correo@empresa.com').fill('qa@example.invalid');
  await page.getByPlaceholder('30-12345678-9').fill('30-12345678-9');
  await page.getByPlaceholder('Min 8 chars, 1 mayuscula, 1 numero').fill('RevisionQA1');
  await page.getByPlaceholder('Repetir password').fill('RevisionQA1');
  await page.getByRole('button', { name: 'Crear cuenta y continuar' }).click();
  await expect(page.getByTestId('registration-wizard')).toBeVisible();
  await page.getByPlaceholder('Empresa S.A.').fill('Empresa QA S.A.');
  await page.getByPlaceholder('Calle 123, Ciudad').fill('Calle QA 123, Mendoza');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Paso 2 de 7', { exact: false }).first()).toBeVisible();
  expect(savedForms.at(-1)?.razonSocial).toBe('Empresa QA S.A.');
  expect(savedForms.at(-1)?.cuit).toBe('30-12345678-9');
  await page.reload();
  await expect(page.getByText('Borrador recuperado.')).toBeVisible();
  await expect(page.getByText('Paso 2 de 7', { exact: false }).first()).toBeVisible();
});

test('un fallo de red al guardar mantiene el paso y muestra el error', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sitrep_access_token', 'limited-test-token');
    localStorage.setItem('sitrep_pending_solicitud', JSON.stringify({ id: 'draft-qa', tipoActor: 'GENERADOR', step: 1 }));
  });
  await page.route('**/api/solicitudes/draft-qa', route => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Sin conexión' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { solicitud: {
      tipoActor: 'GENERADOR', estado: 'BORRADOR', datosActor: JSON.stringify({ razonSocial: 'Empresa QA', domicilio: 'Calle QA 123' }),
      usuario: { nombre: 'QA', email: 'qa@example.invalid', cuit: '30-12345678-9' },
    } } }) });
  });
  await page.goto('/inscripcion/generador');
  await expect(page.getByTestId('registration-wizard')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('alert')).toContainText('Sin conexión');
  await expect(page.getByText('Paso 1 de 7', { exact: false }).first()).toBeVisible();
});
