import {test,expect,devices,type Page,type TestInfo} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {login,prefix,readablePageHeading} from './helpers';
const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/certificate-browser-fixture.json','utf8'));
async function proof(page:Page,info:TestInfo,name:string) {
 await expect(page).toHaveTitle(/SITREP/);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 await expect(page.getByText('Capacitación · sin validez oficial',{exact:false})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await readablePageHeading(page);await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
}
async function sign(page:Page) {
 const canvas=page.locator('#certificaciones canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
 await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();
 for(const [x,y] of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});
 await page.mouse.up();await page.getByRole('button',{name:'Usar firma',exact:true}).click();
}
async function downloadHash(page:Page,kind:string) {
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:kind,exact:true}).click();const d=await waiting;const stream=await d.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,4).toString()).toBe('%PDF');return createHash('sha256').update(bytes).digest('hex');
}
test('agenda navigation filters the full collection and opens pending certificates',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page,info,'operador');await page.goto(prefix(info)+'/dashboard');
 const agenda=page.getByRole('region',{name:'Agenda de manifiestos'}),rows=agenda.locator('[data-agenda-row]');
 await expect(rows).toHaveCount(6);const first=await rows.first().getByRole('link').getAttribute('href');
 await agenda.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(agenda.getByRole('status')).toContainText('Página 2 de');
 expect(await rows.first().getByRole('link').getAttribute('href')).not.toBe(first);
 await agenda.getByLabel('Buscar manifiesto en agenda').fill('QA-AGENDA-0124');
 await expect(rows).toHaveCount(1);await expect(rows).toContainText('QA-AGENDA-0124');await expect(agenda.getByRole('status')).toContainText('Página 1 de 1');
 await agenda.getByLabel('Buscar manifiesto en agenda').clear();await agenda.getByRole('button',{name:/^Por aprobar/}).click();
 await expect(rows).toHaveCount(1);await expect(rows).toContainText('QA-MINE');await expect(rows).toContainText('Te toca aprobar');
 await agenda.getByRole('button',{name:/^En espera/}).click();await expect(rows).toHaveCount(1);await expect(rows).toContainText('QA-WAITING');
 await agenda.getByRole('button',{name:/^En curso/}).click();await expect(rows).toHaveCount(1);await expect(rows).toContainText('QA-FUTURE');
 await agenda.getByRole('button',{name:/^Todos/}).click();await agenda.getByLabel('Fecha de la agenda').selectOption('future');await expect(rows).toHaveCount(1);await expect(rows).toContainText('QA-FUTURE');
 await agenda.getByLabel('Fecha de la agenda').selectOption('all');await agenda.getByRole('button',{name:/^Certificados/}).click();
 const m=fixture.cases[info.project.name];await agenda.getByLabel('Buscar manifiesto en agenda').fill(m.numero);await expect(rows).toHaveCount(1);await expect(rows).toContainText('Emitir certificación final');
 await proof(page,info,'agenda-pending-certificate');await rows.getByRole('link').click();await expect(page).toHaveURL(new RegExp('/manifiestos/'+m.id+'#certificaciones$'));
 await expect(page.getByRole('region',{name:'Certificaciones',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('operator issues signed partial and final; both parties receive notices and the identical PDF',async({browser},info)=>{
 const m=fixture.cases[info.project.name],route=prefix(info)+'/manifiestos/'+m.id,ep='/api/manifiestos/'+m.id+'/certificados';
 const contexts=[],pages:Record<string,Page>={},errors:string[]=[],documents:unknown[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of ['operador','generador','transportista']){const c=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(c);const p=await c.newPage();pages[role]=p;p.on('pageerror',e=>errors.push(e.message));p.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});await login(p,info,role);await p.goto(prefix(info)+'/dashboard');const agenda=p.getByRole('region',{name:'Agenda de manifiestos'});await agenda.getByLabel('Buscar manifiesto en agenda').fill(m.numero);await expect(agenda.getByRole('link',{name:new RegExp(m.numero)})).toBeVisible();await expect(agenda).toContainText(role==='operador'?'Emitir certificación final':'Esperando certificado final');await p.goto(role==='operador'?route:prefix(info)+'/notificaciones');}
  const op=pages.operador;
  await expect(op.getByRole('region',{name:'Certificaciones',exact:true})).toBeVisible();
  for(const type of ['PARCIAL','FINAL']) {
   if(type==='FINAL')for(const role of ['generador','transportista'])await pages[role].goto(prefix(info)+'/notificaciones');
   await op.getByRole('button',{name:type==='PARCIAL'?'Emitir certificación parcial':'Emitir certificación final total',exact:true}).click();
   const amount=op.getByLabel('Cantidad a certificar Y1 (kg)',{exact:true});
   if(type==='PARCIAL'){await expect(amount).toHaveValue('10');await amount.fill('4');}else{await expect(amount).toHaveValue('10');await expect(amount).toBeDisabled();}
   await expect(op.getByLabel('Método de tratamiento certificado',{exact:true})).toHaveValue('QA tratamiento artificial');
   await expect(op.getByRole('button',{name:'Firmar y publicar certificación',exact:true})).toBeDisabled();
   await sign(op);await proof(op,info,type.toLowerCase()+'-ready');
   const waiting=op.waitForResponse(r=>r.url().endsWith(ep)&&r.request().method()==='POST');
   await op.getByRole('button',{name:'Firmar y publicar certificación',exact:true}).click();
   const res=await waiting;expect(res.status(),await res.text()).toBe(201);const record=(await res.json()).data;
   const downloadLabel=type==='PARCIAL'?'Descargar parcial 1':'Descargar final';
   expect(await downloadHash(op,downloadLabel)).toBe(record.pdfSha256);
   for(const role of ['generador','transportista']) {
    const p=pages[role],notice=p.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:record.numero});
    await expect(notice).toBeVisible({timeout:40000});await expect(notice).toContainText(type==='FINAL'?'Certificación final total disponible':'Certificación parcial disponible');
    await expect(notice).toContainText('Ver certificación y descargar');
    await proof(p,info,type.toLowerCase()+'-notice-'+role);
    await notice.getByRole('button',{name:/^Abrir aviso:/}).click();
    await expect(p).toHaveURL(new RegExp('/manifiestos/'+m.id+'\\?certificado='+record.id+'#certificaciones$'));
    const card=p.locator('[data-certificate-id="'+record.id+'"]');await expect(card).toBeVisible();
    await expect(p.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
    expect(await downloadHash(p,downloadLabel)).toBe(record.pdfSha256);
    const dismiss=p.getByRole('button',{name:'Cerrar notificación',exact:true});if(await dismiss.isVisible())await dismiss.click();
    await proof(p,info,type.toLowerCase()+'-document-'+role);
    if(type==='FINAL'&&role==='generador')await p.getByRole('region',{name:'Certificaciones',exact:true}).screenshot({path:info.outputPath('certificates-block.png'),animations:'disabled'});
   }
   for(const role of ['operador','generador','transportista']){
    const p=pages[role];await p.goto(prefix(info)+'/dashboard');const agenda=p.getByRole('region',{name:'Agenda de manifiestos'});await agenda.getByLabel('Buscar manifiesto en agenda').fill(m.numero);
    if(type==='FINAL')await expect(agenda.getByText('Sin manifiestos para estos filtros.')).toBeVisible();
    else await expect(agenda.getByRole('link',{name:new RegExp(m.numero)})).toBeVisible();
    await proof(p,info,type.toLowerCase()+'-agenda-'+role);await p.goto(role==='operador'?route:prefix(info)+'/notificaciones');
   }
   documents.push(record);
  }
  await expect(op.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
  await expect(op.getByRole('button',{name:'Descargar Certificado',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);writeFileSync(info.outputPath('proof.json'),JSON.stringify({surface:info.project.name,manifest:m.id,documents,realLogins:3,cap:false,samePdfAcrossRoles:true,noticesReceivedWithoutReload:true,errors}));
 }finally{for(const c of contexts)await c.close();}
});

async function step(page:Page,number:number){
 const select=page.getByRole('combobox',{name:'Paso del registro',exact:true});
 if(await select.isVisible())await select.selectOption(String(number));else await page.getByRole('button',{name:new RegExp('^'+number+'\\. ')}).click();
}
async function saved(page:Page){await expect(page.getByRole('region',{name:'Borrador del alta'}).getByRole('status')).toHaveText('Guardado en SITREP · podés continuar en otro dispositivo',{timeout:25000});}
function contextOptions(info:TestInfo){return {baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,isMobile:info.project.use.isMobile,hasTouch:info.project.use.hasTouch,serviceWorkers:'block' as const};}
for(const actor of ['generador','operador','transportista'])test(actor+': same account resumes fields, current step and private PDF in a clean device',async({browser},info)=>{
 const first=await browser.newContext(contextOptions(info)),second=await browser.newContext(contextOptions(info));const errors:string[]=[];
 const route=prefix(info)+'/admin/actores/'+(actor==='generador'?'generadores':actor==='operador'?'operadores':'transportistas')+'/nuevo';
 const last=actor==='generador'?6:actor==='operador'?7:5,name='QA continuidad '+actor+' '+info.project.name;
 try{
  const a=await first.newPage();a.on('pageerror',e=>errors.push(e.message));await login(a,info,'admin');await a.goto(route);
  await a.getByLabel('Razon Social *',{exact:true}).fill(name);await a.getByLabel('CUIT *',{exact:true}).fill('99-98765432-0');await a.getByLabel('Email *',{exact:true}).fill('draft-'+actor+'@night-qa.invalid');
  if(actor==='transportista')await a.getByLabel('Contraseña inicial *',{exact:true}).fill('OnlyLocal-NightQA-2026!');
  await step(a,last);
  const {jsPDF}=createRequire(new URL('../../package.json',import.meta.url))('jspdf'),doc=new jsPDF();doc.text('ARTIFICIAL QA '+name,15,20);const bytes=Buffer.from(doc.output('arraybuffer'));
  if(actor==='transportista')await a.locator('input[type=file]').setInputFiles({name:'QA-continuidad.pdf',mimeType:'application/pdf',buffer:bytes});
  else await a.getByLabel('Adjuntar Memoria Tecnica',{exact:true}).setInputFiles({name:'QA-continuidad.pdf',mimeType:'application/pdf',buffer:bytes});
  await saved(a);
  if(actor==='operador'){
   await step(a,1);await saved(a);await first.setOffline(true);await a.getByLabel('Telefono',{exact:true}).fill('0000099999');
   await expect(a.getByRole('region',{name:'Borrador del alta'}).getByRole('alert')).toBeVisible({timeout:20000});await expect(a.getByLabel('Telefono',{exact:true})).toHaveValue('0000099999');
   await first.setOffline(false);await a.getByRole('button',{name:'Guardar borrador',exact:true}).click();await saved(a);await step(a,last);await saved(a);
  }
  await proof(a,info,actor+'-saved');await first.close();
  const b=await second.newPage();b.on('pageerror',e=>errors.push(e.message));await login(b,info,'admin');await b.goto(route);
  const draft=b.getByRole('region',{name:'Borrador del alta'});await draft.getByRole('button',{name:'Recuperar borrador',exact:true}).click();
  await expect(b.getByText('QA-continuidad.pdf',{exact:actor!=='transportista'}).first()).toBeVisible();await expect(b.getByText('Volvé a seleccionar los archivos',{exact:false})).toHaveCount(0);await saved(b);
  await proof(b,info,actor+'-recovered-file');await step(b,1);await expect(b.getByLabel('Razon Social *',{exact:true})).toHaveValue(name);await expect(b.getByLabel('Email *',{exact:true})).toHaveValue('draft-'+actor+'@night-qa.invalid');
  if(actor==='transportista')await expect(b.getByLabel('Contraseña inicial *',{exact:true})).toHaveValue('');
  await saved(b);await proof(b,info,actor+'-recovered-fields');
  if(actor==='operador'){
   await expect(b.getByLabel('Telefono',{exact:true})).toHaveValue('0000099999');const third=await browser.newContext(contextOptions(info));
   try{const c=await third.newPage();await login(c,info,'admin');await c.goto(route);await c.getByRole('button',{name:'Recuperar borrador',exact:true}).click();await c.getByLabel('Razon Social *',{exact:true}).fill(name+' remoto');await saved(c);
    await b.getByLabel('Razon Social *',{exact:true}).fill(name+' local');await expect(draft.getByRole('alert')).toContainText('cambió en otro dispositivo',{timeout:20000});await expect(b.getByLabel('Razon Social *',{exact:true})).toHaveValue(name+' local');await proof(b,info,'conflict-preserves-visible-edit');
    await draft.getByRole('button',{name:'Revisar versión de SITREP',exact:true}).click();await draft.getByRole('button',{name:'Recuperar borrador',exact:true}).click();await expect(b.getByLabel('Razon Social *',{exact:true})).toHaveValue(name+' remoto');await saved(b);
   }finally{await third.close();}
  }
  // Finish by explicitly discarding this artificial draft through its own UI.
  await b.reload();await draft.getByRole('button',{name:'Continuar sin recuperar',exact:true}).click();await expect(draft.getByRole('button',{name:'Recuperar borrador',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
 }finally{await first.close();await second.close();}
});
for(const actor of ['generador','operador','transportista'])test(actor+': applicant autosaves without leaving the current step and resumes after a fresh login',async({browser},info)=>{
 const first=await browser.newContext(contextOptions(info)),second=await browser.newContext(contextOptions(info));const key='application-'+actor+'-'+info.project.name;
 async function enter(page:Page){
  await page.context().addCookies([{name:'sitrep_qa_client',value:'127.18.22.'+Math.ceil(Math.random()*240),url:'http://127.0.0.1:4177'}]);
  await page.goto(prefix(info)+'/login');await page.getByLabel('Correo electrónico o CUIT').fill(key+'@night-qa.invalid');await page.getByLabel('Contraseña',{exact:true}).fill('OnlyLocal-NightQA-2026!');await page.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(page).not.toHaveURL(/\/login$/);await page.goto(prefix(info)+'/mi-solicitud');await page.getByRole('button',{name:'Continuar borrador',exact:true}).click();await expect(page.getByTestId('registration-wizard')).toBeVisible();
 }
 try{
  const a=await first.newPage();await enter(a);await a.getByLabel('Razon Social *',{exact:true}).fill('QA autosave '+key);await a.getByLabel('Domicilio',{exact:true}).fill('QA domicilio sin confirmar 22');
  await expect(a.getByRole('status').filter({hasText:'Borrador guardado en SITREP · todavía no enviado'})).toBeVisible({timeout:20000});
  await a.getByRole('button',{name:'Siguiente',exact:true}).click();const field=actor==='generador'?'N de Inscripcion':actor==='operador'?'N de Habilitacion':'N Habilitacion';await a.getByLabel(field,{exact:true}).fill('QA-STEP-2-'+info.project.name);await expect(a.getByRole('status').filter({hasText:'Borrador guardado en SITREP · todavía no enviado'})).toBeVisible({timeout:20000});await first.close();
  const b=await second.newPage();await enter(b);await expect(b.getByLabel(field,{exact:true})).toHaveValue('QA-STEP-2-'+info.project.name);await b.getByRole('navigation',{name:'Etapas de la inscripción'}).getByRole('button',{name:/^Paso 1 de /}).click();await expect(b.getByLabel('Razon Social *',{exact:true})).toHaveValue('QA autosave '+key);await expect(b.getByLabel('Domicilio',{exact:true})).toHaveValue('QA domicilio sin confirmar 22');await proof(b,info,actor+'-applicant-resumed');
 }finally{await first.close();await second.close();}
});

for(const [guide,title] of [['agenda-completa-certificados','Agenda completa y certificados pendientes'],['altas-continuar-dispositivo','Continuar un alta sin perder el trabajo']])test('manual: '+guide,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/manual/tutorial.html?guide='+guide);await expect(page.locator('#tutorialTitle')).toHaveText(title);await expect(page.locator('.guide-step')).toHaveCount(4);
 if(info.project.name!=='web-desktop')await page.getByRole('button',{name:/Índice del tutorial/}).click();await page.locator('#tutorialIndex a').last().click();await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ratio:1});await page.reload();await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current','step');expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:info.outputPath(guide+'.png'),animations:'disabled'});expect(errors).toEqual([]);
});
