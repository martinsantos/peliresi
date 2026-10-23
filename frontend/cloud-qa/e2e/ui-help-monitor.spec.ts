import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { login, prefix } from './helpers';
async function proof(page:Page,info:TestInfo,name:string) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
}
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
