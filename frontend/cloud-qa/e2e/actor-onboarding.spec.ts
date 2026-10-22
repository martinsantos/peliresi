import { syntheticCuit } from '../synthetic-cuit';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { isolatedMapTiles, login, prefix, readablePageHeading } from './helpers';
import { assertCloudDatabase, backendRequire } from '../safety';

const { PrismaClient } = backendRequire('@prisma/client');
const { jsPDF } = createRequire(new URL('../../package.json', import.meta.url))('jspdf');
const password = 'OnlyLocal-NightQA-2026!';
const observation = 'Corregí el domicilio y reemplazá la constancia AFIP por la versión actualizada.';
test.beforeEach(async ({ page }, info) => { await isolatedMapTiles(page, info); });

async function syntheticVerification(email: string) {
  await assertCloudDatabase();
  expect(['actor_onboarding_20261020', 'circuit_review_20261020', 'actor_representation_20261022']).toContain(new URL(process.env.DATABASE_URL!).searchParams.get('schema'));
  const db = new PrismaClient(), token = 'qa-proof-' + randomUUID();
  try {
    const user = await db.usuario.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(false); expect(user.activo).toBe(false);
    // Providers stay OFF. Replace only this new artificial account's verification
    // proof, then consume it through the real UI/controller; never mark it verified.
    await db.usuario.update({ where: { id: user.id }, data: { emailVerificationToken: createHash('sha256').update(token).digest('hex') } });
    return { token, id: user.id };
  } finally { await db.$disconnect(); }
}
function pdf(lines: string[]) { const doc = new jsPDF(); doc.text(['ARTIFICIAL QA - SIN VALIDEZ', ...lines], 15, 25); return Buffer.from(doc.output('arraybuffer')); }
async function attach(page: Page, id: string, type: string, name: string, bytes: Buffer, mimeType = 'application/pdf', replace = false) {
  const row = page.getByTestId('registration-document-' + type);
  const result = page.waitForResponse(r => new URL(r.url()).pathname === `/api/solicitudes/${id}/documentos` && r.request().method() === 'POST');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), row.getByRole('button', { name: replace ? /^Reemplazar / : 'Adjuntar', exact: !replace }).click()]);
  await chooser.setFiles({ name, mimeType, buffer: bytes });
  const response = await result; expect(response.status()).toBe(201);
  const document = (await response.json()).data.documento;
  expect(document.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  await expect(row).toContainText('Guardado'); return document;
}
async function next(page: Page, number: number) {
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Etapas de la inscripción' }).getByRole('button', { name: new RegExp(`^Paso ${number} de `) })).toHaveAttribute('aria-current', 'step');
}
async function signIn(page: Page, info: TestInfo, email: string) {
  // Exercise an actual fresh login. Navigating to /login with an existing
  // restricted session can legitimately redirect before the form submits.
  await page.goto(prefix(info) + '/mi-solicitud');
  const exit = page.getByRole('button', { name: 'Salir', exact: true });
  const identifier = page.getByLabel('Correo electrónico o CUIT');
  // The wizard's pre-verification credential need not be an AuthContext session.
  // Either the real login form or the applicant's real logout must be ready.
  await expect(exit.or(identifier)).toBeVisible();
  if (await exit.isVisible()) { await exit.click(); await expect(page).toHaveURL(/\/login$/); }
  await page.goto(prefix(info) + '/login');
  await page.getByLabel('Correo electrónico o CUIT').fill(email); await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const result = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click(); expect((await result).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
}
async function clean(page: Page) {
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await readablePageHeading(page);
}

for (const actor of ['generador', 'transportista', 'operador']) test(`${actor}: verified draft, full declaration, ATM, correction and approved account`, async ({ page, browser }, info) => {
  const id = randomUUID(), email = id + '@night-qa.invalid', cuit = syntheticCuit(Date.now()), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().addCookies([{ name: 'sitrep_qa_client', value: '127.13.' + Math.floor(Math.random()*240) + '.12', url: 'http://127.0.0.1:4177' }]);
  await page.goto(`${prefix(info)}/inscripcion/${actor}`); await expect(page).toHaveTitle(/SITREP/);
  await page.getByLabel('Nombre completo *', { exact: true }).fill('QA alta ' + actor + ' ' + id);
  await page.getByLabel('Email *', { exact: true }).fill(email); await page.getByLabel('CUIT *', { exact: true }).fill(cuit);
  await page.getByLabel('Contraseña *', { exact: true }).fill(password); await page.getByLabel('Confirmar contraseña *', { exact: true }).fill(password);
  const created = page.waitForResponse(r => r.url().endsWith('/solicitudes/iniciar') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Crear cuenta y continuar', exact: true }).click();
  const response = await created; expect(response.status()).toBe(201); const application = (await response.json()).data.solicitudId;
  await page.getByLabel('Razon Social *', { exact: true }).fill('QA establecimiento ' + actor + ' ' + id);
  await page.getByLabel('Domicilio', { exact: true }).fill('QA domicilio declarado 100');
  await page.getByLabel('Telefono', { exact: true }).fill('0000000000');
  await page.getByLabel('Email de contacto', { exact: true }).fill(email);
  if (actor === 'operador') { await page.getByLabel('Tipo de Operador', { exact: true }).click(); await page.getByRole('option', { name: 'Operador in situ', exact: true }).click(); }
  await next(page, 2);
  if (actor === 'generador') {
    await page.getByLabel('N de Inscripcion', { exact: true }).fill('G-QA-' + id.slice(0,8));
    await page.getByLabel('Categoria', { exact: true }).click(); await page.getByRole('option', { name: 'Medianos Generadores', exact: true }).click();
  } else {
    await page.getByLabel(actor === 'operador' ? 'N de Habilitacion' : 'N Habilitacion', { exact: true }).fill('HAB-QA-' + id.slice(0,8));
    await page.getByLabel('Vencimiento Habilitacion', { exact: true }).fill('2028-12-31');
    if (actor === 'operador') await page.getByLabel('Categoria', { exact: true }).fill('Tratamiento artificial QA');
    else await page.getByLabel('Corrientes Autorizadas', { exact: true }).fill('Y8, Y12');
  }
  await next(page, 3);
  if (actor !== 'transportista') {
    const legal = page.getByRole('region', { name: 'Domicilio legal', exact: true });
    await legal.getByLabel('Calle', { exact: true }).fill('QA calle legal 100'); await legal.getByLabel('Localidad', { exact: true }).fill('Mendoza');
    await page.getByRole('button', { name: 'Copiar domicilio legal', exact: true }).click();
    await page.getByLabel('Coordenadas Geograficas', { exact: true }).fill('-32.89, -68.84');
  } else {
    await page.getByRole('button', { name: 'Agregar vehículo', exact: true }).click(); const vehicle = page.getByRole('group', { name: /^Vehículo 1/ });
    for (const [label,value] of [['Patente *','QA123ZZ'],['Ano *','2026'],['Capacidad (kg) *','12500'],['Vencimiento *','2028-12-31']]) await vehicle.getByLabel(label,{exact:true}).fill(value);
    await page.getByRole('button', { name: 'Agregar chofer', exact: true }).click(); const driver = page.getByRole('group', { name: 'Chofer 1', exact: true });
    for (const [label,value] of [['Nombre *','JUAN QA'],['Apellido','ARTIFICIAL'],['DNI *','90000001'],['Licencia','QA-LIC-1'],['Vencimiento *','2028-12-31']]) await driver.getByLabel(label,{exact:true}).fill(value);
  }
  const saved = page.waitForResponse(r => r.url().endsWith('/solicitudes/' + application) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); expect((await saved).status()).toBe(200);
  await page.reload(); await expect(page.getByTestId('registration-wizard')).toBeVisible(); await clean(page);
  const proof = await syntheticVerification(email);
  await page.goto(`${prefix(info)}/verificar-email?token=${proof.token}`); await expect(page.getByRole('heading',{name:'Email verificado',exact:true})).toBeVisible();
  await page.getByRole('link', { name: 'Continuar en SITREP', exact: true }).click();
  await expect(page.getByTestId('registration-wizard')).toBeVisible();
  // Returning through the real login is a separate entry into the owned draft.
  await signIn(page, info, email); await page.goto(prefix(info) + '/mi-solicitud');
  // A verified applicant must be able to resume without a multirole feature flag.
  await expect(page.getByRole('button', { name: 'Continuar borrador', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(actor+'-draft-entry.png'), animations:'disabled' });
  await page.getByRole('button', { name:'Continuar borrador',exact:true }).click();
  await expect(page.getByTestId('registration-wizard')).toBeVisible();
  await next(page,4);
  if (actor !== 'transportista') {
    if (actor === 'operador') {
      await page.locator('#registration-representanteLegalNombre').fill('Responsable legal QA');
      await page.locator('#registration-representanteTecnicoNombre').fill('Responsable tecnico QA');
      await page.locator('#registration-representanteTecnicoMatricula').fill('MAT-QA-1');
      await next(page,5); await page.getByLabel('Corrientes Y autorizadas',{exact:true}).fill('Y8, Y12');
    } else await page.getByLabel('Corrientes de Control',{exact:true}).fill('Y8, Y12');
    await next(page,actor==='generador'?5:6);
    await page.getByLabel('Personal en planta',{exact:true}).fill('32'); await page.getByLabel('Potencia instalada (HP)',{exact:true}).fill('120');
    await page.getByLabel('Superficie cubierta (m²)',{exact:true}).fill('1250'); await page.getByLabel('Zona del establecimiento',{exact:true}).selectOption('zona_industrial');
    await expect(page.getByTestId('tef-calculator')).toHaveCount(0); await next(page,actor==='generador'?6:7);
  }
  const legalTypes=['CONSTANCIA_AFIP','CERTIFICADO_HABILITACION',actor==='generador'?'MEMORIA_TECNICA':actor==='operador'?'RESOLUCION_DPA':'SEGURO_AMBIENTAL'];
  for (const type of legalTypes) await attach(page,application,type,type+'-QA.pdf',pdf([type,id]));
  const payment=String(Date.now()), receipt=await attach(page,application,'COMPROBANTE_PAGO','Pago-ATM-QA.pdf',pdf(['ATM ADMINISTRACION TRIBUTARIA MENDOZA','ID Comprobante: '+payment,'Transaccion: 88'+payment,'Control: 77'+payment,'CUIT: '+cuit,'Codigo de Tasa: 162','Fecha Pago: 20/10/2026','IMPORTE TOTAL: $12.500,00']));
  if(actor!=='transportista'){
    const sharp=backendRequire('sharp'), issuer=actor==='operador'?'Cooperativa Empresa Electrica de Godoy Cruz':'EDEMSA';
    const image=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="white"/>${[issuer,'FACTURA ARTIFICIAL SIN VALIDEZ','Tarifa: T2 R BT','Consumo facturado: 1250 kWh','Potencia contratada: 45 kW','NIC: 900000001','Periodo: 2026/10'].map((line,i)=>`<text x="50" y="${70+i*75}" font-family="DejaVu Sans" font-size="32">${line}</text>`).join('')}</svg>`)).png().toBuffer();
    const bill=await attach(page,application,'FACTURA_ELECTRICA','Factura-electrica-QA.png',image,'image/png');
    expect(bill.analisis.electricidad.campos).toMatchObject({categoriaTarifaria:'T2RBT',consumoKwh:'1250',potenciaContratadaKw:'45'});
    await expect(page.getByLabel('Lectura de factura eléctrica',{exact:true})).toContainText('1250 kWh');
    await page.screenshot({path:info.outputPath(actor+'-electricity.png'),animations:'disabled'});
  }else await expect(page.getByTestId('registration-document-FACTURA_ELECTRICA')).toHaveCount(0);
  await next(page,actor==='generador'?7:actor==='operador'?8:5);
  const send=page.waitForResponse(r=>r.url().endsWith(`/solicitudes/${application}/enviar`)&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Enviar solicitud',exact:true}).click();expect((await send).status()).toBe(200);
  await expect(page.getByRole('heading',{name:'Solicitud enviada',exact:true})).toBeVisible();
  const adminContext=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,isMobile:info.project.use.isMobile,hasTouch:info.project.use.hasTouch});
  const admin=await adminContext.newPage();admin.on('pageerror',error=>errors.push(error.message));
  try{
    await login(admin,info,'admin-'+(actor==='transportista'?'transporte':actor));await admin.goto(`${prefix(info)}/admin/solicitudes/${application}`);
    await expect(admin.getByRole('button',{name:'Observar',exact:true})).toBeVisible();
    const rejected=admin.waitForResponse(r=>r.url().includes(`/solicitudes/${application}/documentos/`)&&r.url().endsWith('/revisar'));
    await admin.getByRole('button',{name:'Rechazar documento CONSTANCIA_AFIP-QA.pdf',exact:true}).click();expect((await rejected).status()).toBe(200);
    await admin.getByRole('button',{name:'Observar',exact:true}).click();const modal=admin.getByRole('dialog',{name:'Observar Solicitud',exact:true});
    await modal.getByLabel('Observaciones *',{exact:true}).fill(observation);
    const observed=admin.waitForResponse(r=>r.url().endsWith(`/solicitudes/${application}/observar`));await modal.getByRole('button',{name:'Enviar Observaciones',exact:true}).click();expect((await observed).status()).toBe(200);
    await page.goto(prefix(info)+'/mi-solicitud');await expect(page.getByText(observation,{exact:true}).first()).toBeVisible();
    await expect(page.getByRole('button',{name:'Corregir datos y documentos',exact:true})).toBeVisible();
    const alignment = await page.getByRole('button',{name:'Corregir datos y documentos',exact:true}).evaluate(button => {
      const icon = button.querySelector('svg')!.getBoundingClientRect(), text = button.lastElementChild!.getBoundingClientRect();
      return { iconPrecedesLabel: icon.right <= text.left + 1, insideViewport: icon.left >= 0 && text.right <= innerWidth + 1 };
    });
    expect(alignment).toEqual({ iconPrecedesLabel: true, insideViewport: true });
    await clean(page); await page.screenshot({path:info.outputPath(actor+'-observed-entry.png'),animations:'disabled'});
    await page.getByRole('button',{name:'Corregir datos y documentos',exact:true}).click();await expect(page.getByTestId('registration-wizard')).toBeVisible();
    await expect(page.getByText(observation,{exact:true})).toBeVisible();
    await page.getByRole('navigation',{name:'Etapas de la inscripción'}).getByRole('button',{name:/^Paso 1 de /}).click();
    await expect(page.getByLabel('Razon Social *',{exact:true})).toHaveValue('QA establecimiento '+actor+' '+id);
    await page.getByLabel('Domicilio',{exact:true}).fill('QA domicilio corregido 200');
    const docStep=actor==='generador'?6:actor==='operador'?7:4;
    await page.getByRole('navigation',{name:'Etapas de la inscripción'}).getByRole('button',{name:new RegExp(`^Paso ${docStep} de `)}).click();
    await expect(page.getByTestId('registration-document-CONSTANCIA_AFIP')).toContainText('Documento rechazado');
    await attach(page,application,'CONSTANCIA_AFIP','CONSTANCIA_AFIP-CORREGIDA-QA.pdf',pdf(['CONSTANCIA CORREGIDA',id]),'application/pdf',true);
    await next(page,docStep+1);const resent=page.waitForResponse(r=>r.url().endsWith(`/solicitudes/${application}/enviar`));
    await page.getByRole('button',{name:'Enviar solicitud',exact:true}).click();expect((await resent).status()).toBe(200);
    await admin.reload();await expect(admin.getByRole('button',{name:'Aprobar',exact:true})).toBeVisible();
    const form=admin.getByTestId('payment-identity-review');await form.locator('summary').click();
    const identity={'ID Comprobante ATM':payment,'CUIT del obligado':cuit.replace(/\D/g,''),'Código de tasa':'162','Fecha de pago':'2026-10-20','Importe pagado (ARS)':'12500','Período / concepto':'2026/10','Referencia de liquidación o trámite':'QA-LIQ-'+id,'Transacción (si figura)':'88'+payment,'Control (si figura)':'77'+payment};
    for(const[label,value]of Object.entries(identity))await form.getByLabel(label,{exact:true}).fill(value);
    await form.getByRole('checkbox').check();const reserved=admin.waitForResponse(r=>r.url().endsWith(`/documentos/${receipt.id}/identidad-pago`));
    await form.getByRole('button',{name:'Confirmar y reservar pago',exact:true}).click();expect((await reserved).status()).toBe(200);
    await expect(admin.getByRole('status').filter({hasText:'Pago reservado para este trámite'})).toBeVisible();
    for(const name of ['CONSTANCIA_AFIP-CORREGIDA-QA.pdf',...legalTypes.slice(1).map(type=>type+'-QA.pdf'),'Pago-ATM-QA.pdf',...(actor==='transportista'?[]:['Factura-electrica-QA.png'])]){
      const reviewed=admin.waitForResponse(r=>r.url().includes(`/solicitudes/${application}/documentos/`)&&r.url().endsWith('/revisar'));
      await admin.getByRole('button',{name:'Aprobar documento '+name,exact:true}).click();expect((await reviewed).status()).toBe(200);
    }
    await clean(admin);await admin.screenshot({path:info.outputPath(actor+'-review.png'),animations:'disabled'});
    const approved=admin.waitForResponse(r=>r.url().endsWith(`/solicitudes/${application}/aprobar`)&&r.request().method()==='POST');
    await admin.getByRole('button',{name:'Aprobar',exact:true}).click();await admin.getByRole('dialog',{name:'Confirmar Aprobacion',exact:true}).getByRole('button',{name:'Confirmar Aprobacion',exact:true}).click();expect((await approved).status()).toBe(200);
    await page.goto(prefix(info)+'/mi-solicitud');
    await expect(page.getByRole('heading',{name:'Tu inscripcion fue aprobada',exact:true})).toBeVisible();
    await clean(page);await page.screenshot({path:info.outputPath(actor+'-approved-entry.png'),animations:'disabled'});
    await page.getByRole('button',{name:'Ingresar con mi cuenta',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
    await signIn(page,info,email);const intro=page.getByRole('button',{name:'Saltar introducción',exact:true});if(await intro.isVisible())await intro.click();
    await page.goto(prefix(info)+'/notificaciones');await expect(page.getByText('Solicitud aprobada',{exact:true}).first()).toBeVisible();await clean(page);
    await expect(page.getByText('Abrir solicitud y ver su estado →').first()).toBeVisible();
    await page.screenshot({path:info.outputPath(actor+'-approved-account.png'),animations:'disabled'});
    await page.getByRole('button',{name:'Abrir aviso: Solicitud aprobada',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`/mi-solicitud\\?solicitud=${application}$`));
    await expect(page.getByRole('heading',{name:'Tu inscripcion fue aprobada',exact:true})).toBeVisible();
    const db=new PrismaClient();try{
      const state=await db.solicitudInscripcion.findUniqueOrThrow({where:{id:application}});expect(state.estado).toBe('APROBADA');
      const actual=await db[actor].findFirstOrThrow({where:{usuarioId:proof.id}});expect(actual.domicilio).toBe('QA domicilio corregido 200');
      if(actor!=='transportista')expect(actual.tefInputs).toMatchObject({potenciaHP:120,personal:32,superficieM2:1250});
      else{expect(await db.vehiculo.count({where:{transportistaId:actual.id}})).toBe(1);expect(await db.chofer.count({where:{transportistaId:actual.id}})).toBe(1);}
      const registry=await db.registroPagoComprobante.findFirstOrThrow({where:{ambito:'SOLICITUD:'+application}});expect(registry.estado).toBe('APLICADO');
      expect(await db.pagoTEF.count()).toBe(0);expect(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}})).toBe(0);expect(await db.emailQueue.count({where:{intentos:{gt:0}}})).toBe(0);
      writeFileSync(info.outputPath('case.json'),JSON.stringify({actor,application,user:proof.id,actorId:actual.id,receiptId:registry.id,verifiedViaSyntheticProof:true,providersOff:true}));
    }finally{await db.$disconnect();}
    expect(errors).toEqual([]);
  }finally{await adminContext.close();}
});

for (const actor of ['generador', 'transportista', 'operador']) test(`${actor}: rejected result remains readable without offering forbidden actions`, async ({ page, browser }, info) => {
  const id = randomUUID(), email = id + '@night-qa.invalid', cuit = syntheticCuit(Date.now());
  // Preparation creates only this test's complete artificial declaration. The
  // verification, administrator decision and return to the result use real UI.
  const started = await page.request.post('/api/solicitudes/iniciar', { data: { email, cuit, nombre: 'QA rechazo ' + id, password, tipoActor: actor.toUpperCase() } });
  expect(started.status()).toBe(201); const setup = (await started.json()).data, application = setup.solicitudId;
  const headers = { Authorization: 'Bearer ' + setup.tokens.accessToken };
  expect((await page.request.put('/api/solicitudes/' + application, { headers, data: { datosActor: { razonSocial: 'QA rechazo ' + id, cuit, domicilio: 'QA domicilio 1', tipoOperador: actor === 'operador' ? 'IN_SITU' : undefined } } })).status()).toBe(200);
  const requirements = (await (await page.request.get('/api/solicitudes/requisitos/' + actor.toUpperCase())).json()).data.documentos;
  for (const requirement of requirements.filter((r: {required: boolean}) => r.required)) {
    const uploaded = await page.request.post(`/api/solicitudes/${application}/documentos`, { headers, multipart: { tipo: requirement.tipo, file: { name: 'QA-' + requirement.tipo + '.pdf', mimeType: 'application/pdf', buffer: pdf(['QA rechazo', id, requirement.tipo]) } } });
    expect(uploaded.status()).toBe(201);
  }
  expect((await page.request.post(`/api/solicitudes/${application}/enviar`, { headers })).status()).toBe(200);
  const proof = await syntheticVerification(email);
  await page.goto(`${prefix(info)}/verificar-email?token=${proof.token}`); await expect(page.getByRole('heading', {name: 'Email verificado', exact: true})).toBeVisible();
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4177', viewport: info.project.use.viewport, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
  const admin = await context.newPage(), reason = 'QA rechazo definitivo ' + id;
  try {
    await login(admin, info, 'admin-' + (actor === 'transportista' ? 'transporte' : actor)); await admin.goto(`${prefix(info)}/admin/solicitudes/${application}`);
    await admin.getByRole('button', {name: 'Rechazar', exact: true}).click(); const dialog = admin.getByRole('dialog', {name: 'Rechazar Solicitud', exact: true});
    await dialog.getByRole('textbox').fill(reason); const result = admin.waitForResponse(r => r.url().endsWith(`/solicitudes/${application}/rechazar`));
    await dialog.getByRole('button', {name: 'Confirmar Rechazo', exact: true}).click(); expect((await result).status()).toBe(200);
    await signIn(page, info, email); await page.goto(prefix(info) + '/mi-solicitud'); await expect(page.getByText('Motivo: ' + reason, {exact: true})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Crear nueva solicitud', exact: true})).toHaveCount(0);
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toHaveCount(0); await expect(page.getByText(/podés consultar los mensajes, pero no enviar respuestas/)).toBeVisible();
    const token = await page.evaluate(() => localStorage.getItem('sitrep_access_token'));
    expect((await page.request.post(`/api/solicitudes/${application}/mensajes`, {headers: {Authorization: 'Bearer ' + token}, data: {contenido: 'QA respuesta que debe rechazarse'}})).status()).toBe(403);
    await clean(page); await page.screenshot({path: info.outputPath(actor + '-rejected-result.png'), animations: 'disabled'});
    const db = new PrismaClient(); try { expect(await db[actor].count({where: {usuarioId: proof.id}})).toBe(0); expect((await db.solicitudInscripcion.findUniqueOrThrow({where: {id: application}})).estado).toBe('RECHAZADA'); } finally {await db.$disconnect();}
    writeFileSync(info.outputPath('rejected-case.json'),JSON.stringify({actor,application,user:proof.id,verifiedViaSyntheticProof:true,providersOff:true}));
  } finally {await context.close();}
});
