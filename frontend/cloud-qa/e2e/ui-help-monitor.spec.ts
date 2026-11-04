import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix, readableFixedAction, readableWholeWords } from './helpers';
async function proof(page:Page,info:TestInfo,name:string) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
}
test('inspection antecedents remain a selected section across links, history and reload', async ({ page }, info) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await login(page, info, 'admin');
 await page.goto(prefix(info) + '/inspecciones?search=QA&etapa=SEGUIMIENTO');
 await expect(page).toHaveTitle(/SITREP/i);
 const sections = page.getByRole('navigation', { name: 'Secciones de Inspecciones' });
 const cases = sections.getByRole('link', { name: 'Expedientes', exact: true });
 const antecedents = sections.getByRole('link', { name: 'Antecedentes', exact: true });
 await expect(cases).toHaveAttribute('aria-current', 'page');
 const loaded = page.waitForResponse(response => response.url().includes('/api/inspecciones/antecedentes?') && response.status() === 200);
 await antecedents.click();
 await loaded;
 const panel = page.getByRole('region', { name: 'Antecedentes para inspección', exact: true });
 await expect(panel).toBeVisible();
 await expect(antecedents).toHaveAttribute('aria-current', 'page');
 await expect(cases).not.toHaveAttribute('aria-current');
 await expect(page.getByLabel('Buscar inspección')).toHaveCount(0);
 await expect(page.getByRole('button', { name: 'Volver a inspecciones', exact: true })).toHaveCount(0);
 await readableWholeWords(panel.getByRole('heading', { name: 'Antecedentes para inspección' }));
 await sections.scrollIntoViewIfNeeded();
 await readableFixedAction(antecedents, sections); await readableFixedAction(cases, sections);
 await proof(page, info, 'inspection-antecedents-section');
 await panel.getByLabel('Estado del antecedente').selectOption('VINCULADA');
 await expect(panel.getByRole('status')).toContainText('Con inspección');
 await page.goBack();
 await expect(cases).toHaveAttribute('aria-current', 'page');
 await expect(page.getByLabel('Buscar inspección')).toHaveValue('QA');
 await expect(page.getByRole('button', { name: /^Seguimiento / })).toHaveAttribute('aria-pressed', 'true');
 await page.goForward();
 await expect(antecedents).toHaveAttribute('aria-current', 'page');
 await page.reload();
 await expect(antecedents).toHaveAttribute('aria-current', 'page');
 await expect(panel).toBeVisible();
 await cases.click(); await expect(cases).toHaveAttribute('aria-current', 'page');
 await page.goto(prefix(info) + '/inspecciones?vista=antecedentes');
 await expect(antecedents).toHaveAttribute('aria-current', 'page');
 await expect(panel).toContainText('Administración evalúa');
 expect(await page.locator('vite-error-overlay').count()).toBe(0);
 expect(errors).toEqual([]);
});
for (const [account, group] of [['operador','Operadores'],['generador','Generadores'],['transportista','Transportistas']]) {
 test(`temporary ${account} access explains the boundary before fields and restores the administrator`,async({page},info)=>{
  await login(page,info,'admin'); await page.goto(prefix(info)+'/switch-user');
  await page.getByLabel('Buscar usuario').fill(account+'@night-qa.invalid');
  const target=page.getByRole('region',{name:group,exact:true}).getByRole('button',{name:/^Ver como /});
  await expect(target).toHaveCount(1);
  const identity=page.waitForResponse(r=>r.url().endsWith('/api/auth/profile')&&r.status()===200);
  const switched=page.waitForResponse(r=>r.url().includes('/api/admin/impersonate/')&&r.request().method()==='POST');
  await target.click(); expect((await switched).status()).toBe(200);
  expect(JSON.stringify(await (await identity).json())).toContain(account+'@night-qa.invalid');
  await expect(page.getByTestId('impersonation-banner')).toBeVisible();
  await expect(page.getByTestId('impersonation-banner')).toContainText('Vista temporal');
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/manifiestos'))writes.push(r.url());});
  await page.goto(prefix(info)+'/manifiestos/nuevo');
  const section=page.getByRole('region',{name:'Estás en una vista temporal'});
  await expect(section).toBeVisible(); await expect(section).toContainText('propia cuenta');
  await expect(page.getByRole('button',{name:'Siguiente',exact:true})).toHaveCount(0);
  const bounds=await page.getByTestId('impersonation-banner').evaluate(el=>{
   const button=el.querySelector('button')!.getBoundingClientRect();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n:Node|null;const overlap=[];
   while((n=walker.nextNode()))if(!el.querySelector('button')!.contains(n)&&n.textContent?.trim()) {const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.right>button.left&&r.left<button.right&&r.top<button.bottom&&r.bottom>button.top)overlap.push(n.textContent);}
   return overlap;
  });expect(bounds).toEqual([]);
  await proof(page,info,'temporary-'+account); await page.reload(); await expect(section).toBeVisible();
  expect(writes).toEqual([]);
  await section.getByRole('button',{name:'Volver a mi cuenta',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(prefix(info)+'/switch-user$'));
  await expect(page.getByRole('heading',{name:'Ver como otro usuario',exact:true})).toBeVisible();
  await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
 });
}
async function choose(page:Page,name:string,value:RegExp){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('option',{name:value}).click();}
test('a real generator proposal reaches the other parties, the bell and the administrator agenda',async({page},info)=>{
 test.setTimeout(150000);
 const browser=page.context().browser()!;
 const observer=await browser.newContext({viewport:info.project.use.viewport});
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const operator=await observer.newPage();operator.on('pageerror',error=>errors.push(error.message));
  const initialNotices=operator.waitForResponse(r=>r.url().includes('/api/notificaciones?')&&new URL(r.url()).searchParams.get('limit')==='20'&&r.status()===200);
  await login(operator,info,'operador');await initialNotices;
  await expect(operator.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();
  // The operator is already online when a different account creates.
  await login(page,info,'generador');await page.goto(prefix(info)+'/manifiestos/nuevo');
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await choose(page,'Tipo de Residuo *',/^Y1 - /);await page.getByLabel('Cantidad *',{exact:true}).fill('9');
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Con traslado/})).toHaveAttribute('aria-pressed','true');
  await choose(page,'Transportista *',/^QA Transporte 1 /);await choose(page,'Operador / Destino *',/^QA Operador 1 /);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/manifiestos')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click();
  const response=await saved;expect(response.status()).toBe(201);const manifest=(await response.json()).data.manifiesto;
  expect(manifest).toMatchObject({estado:'PENDIENTE_APROBACION',modalidad:'FIJO'});
  await operator.bringToFront();
  const live=operator.getByRole('region',{name:'Avisos del sistema'}).filter({hasText:manifest.numero});
  await expect(live).toBeVisible({timeout:25000});
  await expect(live).toContainText('Manifiesto pendiente de tu aprobación');
  await expect(live).toContainText('QA Generador 1');
  await readableFixedAction(live.getByRole('button',{name:'Abrir manifiesto y ver qué sigue →',exact:true}),live);
  await proof(operator,info,'operator-live-proposal-notice');
  const queue=operator.getByRole('region',{name:'Agenda de manifiestos'});
  const row=queue.getByRole('link',{name:new RegExp(manifest.numero)});
  await expect(row).toContainText('Te toca aprobar');
  await expect(row).toContainText('QA Generador 1 → QA Operador 1');
  await expect(row).toHaveAttribute('title',/Falta aprobar: Generador, Transporte, Operador/);
  for(const party of ['Generador','Transporte','Operador']) await expect(row.getByLabel(party+': Pendiente',{exact:true})).toBeVisible();
  await readableWholeWords(row.getByText(manifest.numero,{exact:true}));
  await operator.getByRole('button',{name:/^Notificaciones(?: \(|$)/}).click();
  const bell=operator.getByRole('region',{name:'Notificaciones recientes'});
  const notice=bell.getByRole('button').filter({hasText:manifest.numero});
  await expect(notice).toHaveCount(1);
  await notice.click();await expect(operator).toHaveURL(new RegExp('/manifiestos/'+manifest.id+'$'));
  await expect(operator.getByRole('region',{name:'Aprobaciones de las partes'})).toBeVisible();
  await expect(operator.getByRole('button',{name:'Iniciar coordinación',exact:true})).toHaveCount(0);
  await expect(operator.getByRole('button',{name:'Confirmar Retiro',exact:true})).toHaveCount(0);
  await proof(operator,info,'operator-pending-approval');
  await observer.close();
  for(const role of ['transportista','admin']){
   const context=await browser.newContext({viewport:info.project.use.viewport});
   try{
    const reader=await context.newPage();reader.on('pageerror',error=>errors.push(error.message));await login(reader,info,role);
    const agenda=reader.getByRole('region',{name:'Agenda de manifiestos'});
    const pending=agenda.getByRole('button',{name:'Por aprobar',exact:true});
    await expect(pending).toBeVisible();await pending.click();
    await agenda.getByLabel('Buscar manifiesto en agenda').fill(manifest.numero);
    const task=agenda.getByRole('link',{name:new RegExp(manifest.numero)});
    await expect(task).toContainText('QA Generador 1 → QA Operador 1');
    await expect(task).toHaveAttribute('title',/Falta aprobar: Generador, Transporte, Operador/);
    await expect(task).toHaveAttribute('title',/Transporte: QA Transporte 1/);
    await readableWholeWords(task.getByText(manifest.numero,{exact:true}));
    await proof(reader,info,role+'-pending-agenda');
   }finally{await context.close();}
  }
  expect(errors).toEqual([]);
 }finally{await observer.close();}
});
test('actual operator can create a proposal and Monitor shows its readable persisted events',async({page},info)=>{
 await login(page,info,'operador');await page.goto(prefix(info)+'/manifiestos/nuevo');
 await choose(page,'Generador *',/^QA Generador 1 /);await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await choose(page,'Tipo de Residuo *',/^Y1 - /);await page.getByLabel('Cantidad *',{exact:true}).fill('7');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();await choose(page,'Transportista *',/^QA Transporte 1 /);
 await page.getByLabel('Observaciones',{exact:true}).fill('QA UI temporal y Monitor '+info.project.name);
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/manifiestos')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click();
 const response=await saved;expect(response.status()).toBe(201);const manifest=(await response.json()).data.manifiesto;
 await expect(page).toHaveURL(new RegExp('/manifiestos/'+manifest.id+'$'));await expect(page.getByRole('region',{name:'Aprobaciones de las partes'})).toBeVisible();await proof(page,info,'actual-operator-proposal');
 // A separate clean context logs into a real synthetic administrator account.
 const admin=await page.context().browser()!.newContext({viewport:info.project.use.viewport});
 try {const monitor=await admin.newPage();await login(monitor,info,'admin');
  const live=monitor.waitForResponse(r=>r.url().endsWith('/api/centro-control/monitor-live')&&r.status()===200);
  await monitor.goto(prefix(info)+'/monitor');const payload=(await (await live).json()).data;
  const events=payload.eventosRecientes.filter((e:any)=>e.manifiestoNumero===manifest.numero);
  expect(events.some((e:any)=>e.tipo==='CERTIFICACION_OPERADOR_V1')).toBe(true);expect(events.some((e:any)=>e.tipo==='PROPUESTA_PARTES_V1')).toBe(true);
  const row=monitor.getByRole('button',{name:new RegExp('Abrir evento '+manifest.numero+': El operador debe emitir')});
  await expect(row).toContainText('Certificación habilitada');await row.click();
  await expect(monitor.getByText('Certificación habilitada').last()).toBeVisible();
  await expect(monitor.locator('body')).not.toContainText('CERTIFICACION_OPERADOR_V1');await proof(monitor,info,'monitor-certificate-event');
 } finally {await admin.close();}
});
test('help explains approvals, certificates, temporary access and disabled delivery',async({page},info)=>{
 await login(page,info,'operador');await page.goto(prefix(info)+'/ayuda');
 await page.getByRole('button',{name:'Pendiente de aprobación',exact:true}).click();await expect(page.getByText(/cada parte confirma desde su propia cuenta/)).toBeVisible();
 await proof(page,info,'help-proposal-flow');
 for(const [question,text] of [
  ['¿Cómo creo un nuevo manifiesto?','las tres partes confirmen'],
  ['¿Cómo descargo el certificado de disposición final?','Tratado no significa que ya esté emitido'],
  ['¿Qué permite la Vista temporal (Acceso Comodín)?','No sustituye la cuenta real'],
  ['¿Cómo configuro mis notificaciones por email?','no se envía nada por esos canales']]){
  const button=page.getByRole('button',{name:question,exact:true});await button.click();await expect(button).toHaveAttribute('aria-expanded','true');await expect(page.getByText(text,{exact:false})).toBeVisible();
 }
 await proof(page,info,'help-channel-preference');
 const manual=await page.request.get('/manual/help-data.js');expect(manual.status()).toBe(200);const content=await manual.text();expect(content).toContain('Certificación habilitada');expect(content).toContain('la persona responsable debe crear la propuesta');
});
