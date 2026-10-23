import {test,expect,devices,type Page,type TestInfo} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {login,prefix,readablePageHeading,isolatedMapTiles} from './helpers';
test.beforeAll(() => { expect(process.env.MANIFEST_PROPOSALS_ENABLED).toBe('true'); });
const roles=['generador','transportista','operador'] as const;
type Role=typeof roles[number];
async function post(page:Page,suffix:string,action:()=>Promise<unknown>,status=200){
 const [res]=await Promise.all([page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='POST',{timeout:30000}),action()]);
 expect(res.status(),suffix+' '+await res.text()).toBe(status);expect(res.headers()['x-sitrep-training']).not.toBe('true');return (await res.json()).data;
}
async function choose(page:Page,name:string,value:RegExp){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('option',{name:value}).click();}
async function proof(page:Page,info:TestInfo,name:string){
 await expect(page).toHaveTitle(/SITREP/);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 await expect(page.getByText('Capacitación · sin validez oficial',{exact:false})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await readablePageHeading(page);await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
}
async function approve(page:Page,id:string,role:Role){
 const region=page.getByRole('region',{name:'Aprobaciones de las partes'});await expect(region).toBeVisible();
 if(role==='generador'){
  await region.getByRole('button',{name:'Firmar Manifiesto',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Firma del manifiesto',exact:true});
  const canvas=dialog.locator('canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
  await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();
  for(const [x,y] of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});
  await page.mouse.up();await dialog.getByRole('button',{name:'Usar firma',exact:true}).click();
  await post(page,'/'+id+'/firmar',()=>dialog.getByRole('button',{name:'Confirmar y Firmar',exact:true}).click());
  await expect(dialog).not.toBeVisible();
 }else await post(page,'/'+id+'/aprobar-parte',()=>region.getByRole('button',{name:role==='operador'?'Aprobar como operador':'Aprobar como transporte',exact:true}).click());
}
async function create(page:Page,info:TestInfo,role:Role){
 await page.goto(`${prefix(info)}/manifiestos`);await page.getByRole('button',{name:'Nuevo Manifiesto',exact:true}).click();
 if(role!=='generador')await choose(page,'Generador *',/^QA Generador 1 /);
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await choose(page,'Tipo de Residuo *',/^Y1 - /);await page.getByLabel('Cantidad *',{exact:true}).fill('21');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 if(role!=='transportista')await choose(page,'Transportista *',/^QA Transporte 1 /);
 await choose(page,'Vehículo (opcional)',/^QA002ZZ/);await choose(page,'Chofer (opcional)',/^QA Segundo/);
 if(role!=='operador')await choose(page,'Operador / Destino *',/^QA Operador 1 /);
 await page.getByLabel('Fecha estimada de retiro',{exact:true}).fill('2099-12-25');
 await proof(page,info,'creation-'+role);
 const result=await post(page,'/api/manifiestos',()=>page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201);
 expect(result.manifiesto.estado).toBe('PENDIENTE_APROBACION');return result.manifiesto;
}
for(const creator of ['operador'] as const)test('complete ordinary lifecycle: '+creator+' creates; each party approves, inbox updates, transport starts',async({browser},info)=>{
 const contexts=[],pages={} as Record<Role,Page>,homes={} as Record<Role,string>,errors:string[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of roles){const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'allow'});contexts.push(context);const page=await context.newPage();pages[role]=page;page.on('pageerror',e=>errors.push(e.message));await login(page,info,role);homes[role]=page.url();await expect(page.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();}
  if(info.project.name==='app')await expect(pages.transportista.getByRole('region',{name:'Viajes del transportista'})).toBeVisible();
  else await expect(pages.transportista.getByRole('button',{name:'Ir al Viaje',exact:true}).first()).toBeVisible();
  const page=pages[creator],m=await create(page,info,creator);
  await expect(page.getByRole('region',{name:'Aprobaciones de las partes'})).toContainText('0 de 3 aprobaciones');
  const other=roles.find(r=>r!==creator)!;
  // Counterpart stays in its original page, without navigation/reload.
  const live=pages[other].getByRole('region',{name:'Agenda de manifiestos'});
  await expect(live.locator('[data-agenda-row]').first()).toContainText(m.numero,{timeout:12000});
  await expect(live.locator('[data-agenda-row]').first()).toContainText('Te toca aprobar');
  await approve(page,m.id,creator);await page.goto(homes[creator]);
  const agenda=page.getByRole('region',{name:'Agenda de manifiestos'});
  await expect(agenda.locator('[data-agenda-row]').first()).toContainText(m.numero);
  await expect(agenda.locator('[data-agenda-row]').first()).toContainText('En espera');
  await agenda.getByRole('button',{name:'En espera',exact:true}).click();await proof(page,info,'waiting-'+creator);
  for(const role of roles.filter(r=>r!==creator)){
   await pages[role].getByRole('region',{name:'Agenda de manifiestos'}).getByRole('link',{name:new RegExp(m.numero)}).click();
   const panel=pages[role].getByRole('region',{name:'Aprobaciones de las partes'});
   await expect(panel.getByRole('button',{name:'Iniciar coordinación',exact:true})).toHaveCount(0);
   await approve(pages[role],m.id,role);
  }
  await agenda.getByRole('button',{name:'Todos',exact:true}).click();
  await expect(agenda.locator('[data-agenda-row]').first()).toContainText('Listo para iniciar',{timeout:12000});
  await agenda.getByRole('link',{name:new RegExp(m.numero)}).click();
  const panel=page.getByRole('region',{name:'Aprobaciones de las partes'});await expect(panel).toContainText('3 de 3 · Aprobado');
  for(const label of ['Generador','Transporte','Operador'])await expect(panel.getByLabel(label+': Aprobado',{exact:true})).toBeVisible();
  await proof(page,info,'unanimous-'+creator);
  await post(page,'/'+m.id+'/iniciar-coordinacion',()=>panel.getByRole('button',{name:'Iniciar coordinación',exact:true}).click());
  await expect(panel).toContainText('Coordinación iniciada');
  const transport=pages.transportista;
  if(creator!=='transportista')await expect(transport.getByRole('region',{name:'Aprobaciones de las partes'})).toContainText('Coordinación iniciada',{timeout:12000});
  await expect(transport.getByRole('button',{name:'Confirmar retiro',exact:true})).toBeEnabled({timeout:12000});
  await post(transport,'/'+m.id+'/confirmar-retiro',()=>transport.getByRole('button',{name:'Confirmar retiro',exact:true}).click());
  await expect(transport.getByRole('button',{name:'Confirmar retiro',exact:true})).toHaveCount(0);
  await proof(transport,info,'in-transit-'+creator);
  // Bell is the persistent record. Opening the notice reaches this exact proposal.
  await pages.operador.goto(`${prefix(info)}/notificaciones`);
  const notice=pages.operador.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:m.numero}).filter({hasText:'Coordinación iniciada'});
  await expect(notice).toBeVisible();
  await proof(pages.operador,info,'notices-'+creator);
  await notice.getByRole('button',{name:/^Abrir aviso:/}).click();await expect(pages.operador).toHaveURL(new RegExp('/manifiestos/'+m.id+'$'));

  await transport.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
  const delivery=transport.getByRole('dialog',{name:'Confirmar Entrega?',exact:true});
  await expect(delivery).toBeVisible();
  await post(transport,'/'+m.id+'/confirmar-entrega',()=>delivery.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click());
  await expect(delivery).not.toBeVisible();
  const op=pages.operador;
  await op.reload();
  await post(op,'/'+m.id+'/confirmar-recepcion',()=>op.getByRole('button',{name:'Confirmar Recepcion',exact:true}).click());
  await op.getByRole('button',{name:'Registrar Pesaje',exact:true}).click();
  const weighing=op.getByRole('dialog',{name:'Registrar Pesaje',exact:true});
  await weighing.getByPlaceholder('Peso real',{exact:true}).fill('21');
  await weighing.getByPlaceholder('Observaciones del pesaje...').fill('QA pesaje completo, sólo datos artificiales');
  await post(op,'/'+m.id+'/pesaje',()=>weighing.getByRole('button',{name:'Confirmar Pesaje',exact:true}).click());
  await expect(weighing).not.toBeVisible();
  await op.getByRole('button',{name:'Registrar Tratamiento',exact:true}).click();
  const treatment=op.getByRole('dialog',{name:'Registrar Tratamiento',exact:true});
  await expect(treatment.getByRole('button',{name:/QA ESTABILIZACION/})).toBeVisible();
  await treatment.getByRole('button',{name:/QA ESTABILIZACION/}).click();
  await treatment.getByPlaceholder('Observaciones del tratamiento...').fill('QA tratamiento de la carga verificada');
  await post(op,'/'+m.id+'/tratamiento',()=>treatment.getByRole('button',{name:'Confirmar Tratamiento',exact:true}).click());
  await expect(treatment).not.toBeVisible();
  await proof(op,info,'received-weighed-treated');
  async function downloadHash(p:Page,label:string){
   const wait=p.waitForEvent('download');await p.getByRole('button',{name:label,exact:true}).click();const download=await wait;
   expect(await download.failure()).toBeNull();const stream=await download.createReadStream();const chunks:Buffer[]=[];
   for await(const chunk of stream)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,4).toString()).toBe('%PDF');return createHash('sha256').update(bytes).digest('hex');
  }
  const certificates=[];
  for(const kind of ['PARCIAL','FINAL'] as const){
   if(kind==='FINAL')await post(op,'/'+m.id+'/cerrar',()=>op.getByRole('button',{name:'Cerrar Manifiesto',exact:true}).click());
   for(const role of ['generador','transportista'] as const)await pages[role].goto(prefix(info)+'/notificaciones');
   const region=op.getByRole('region',{name:'Certificaciones',exact:true});
   await region.getByRole('button',{name:kind==='PARCIAL'?'Emitir certificación parcial':'Emitir certificación final total',exact:true}).click();
   const amount=region.getByLabel('Cantidad a certificar Y1 (kg)',{exact:true});await expect(amount).toHaveValue('21');
   if(kind==='PARCIAL')await amount.fill('7');else await expect(amount).toBeDisabled();
   await expect(region.getByLabel('Método de tratamiento certificado',{exact:true})).toHaveValue('QA ESTABILIZACION');
   const signing=region.locator('canvas');await signing.scrollIntoViewIfNeeded();const box=(await signing.boundingBox())!;
   await op.mouse.move(box.x+box.width*.1,box.y+box.height*.5);await op.mouse.down();
   for(const [x,y]of[[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await op.mouse.move(box.x+box.width*x,box.y+box.height*y,{steps:5});await op.mouse.up();
   await region.getByRole('button',{name:'Usar firma',exact:true}).click();
   const record=await post(op,'/'+m.id+'/certificados',()=>region.getByRole('button',{name:'Firmar y publicar certificación',exact:true}).click(),201);
   const label=kind==='PARCIAL'?'Descargar parcial 1':'Descargar final';expect(await downloadHash(op,label)).toBe(record.pdfSha256);
   for(const role of ['generador','transportista'] as const){
    const p=pages[role],notice=p.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:record.numero});
    await expect(notice).toBeVisible({timeout:40000});await notice.getByRole('button',{name:/^Abrir aviso:/}).click();
    await expect(p).toHaveURL(new RegExp('/manifiestos/'+m.id+'\\?certificado='+record.id+'#certificaciones$'));
    await expect(p.locator('[data-certificate-id="'+record.id+'"]')).toBeVisible();expect(await downloadHash(p,label)).toBe(record.pdfSha256);
    await expect(p.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
    await proof(p,info,kind.toLowerCase()+'-received-'+role);
   }
   certificates.push({id:record.id,tipo:kind,sha256:record.pdfSha256});
  }
  await expect(op.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
  await proof(op,info,'final-complete');
  writeFileSync(info.outputPath('complete-lifecycle.json'),JSON.stringify({id:m.id,numero:m.numero,surface:info.project.name,certificates,partialQuantity:7,finalTotal:21,samePdfAcrossParties:true,noticesWithoutReload:true,actualRoles:true,externalDelivery:false}));

  expect(errors).toEqual([]);writeFileSync(info.outputPath('proof.json'),JSON.stringify({creator,id:m.id,numero:m.numero,surface:info.project.name,realLogins:3,cap:false,liveWithoutReload:true,errors}));
 }finally{for(const c of contexts)await c.close();}
});
