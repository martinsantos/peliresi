import {test,expect,devices,type Page,type TestInfo} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {login,prefix,readablePageHeading,isolatedMapTiles} from './helpers';
test.beforeAll(() => { expect(process.env.MANIFEST_PROPOSALS_ENABLED).toBe('true'); });
const roles=['generador','transportista','operador'] as const;
type Role=typeof roles[number];
async function post(page:Page,suffix:string,action:()=>Promise<unknown>,status=200){
 const waiting=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='POST');await action();const res=await waiting;
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
 // A mode switch must never silently remove the third assigned party.
 if(role!=='transportista'){
  await page.getByRole('button',{name:/^En origen/}).click();
  const warning=page.getByRole('alert').filter({hasText:'Ya asignaste un transporte.'});
  await expect(warning).toBeVisible();
  await expect(page.getByRole('button',{name:/^Con traslado/})).toHaveAttribute('aria-pressed','true');
  await warning.getByRole('button',{name:'Mantener transporte',exact:true}).click();
  await expect(page.getByRole('button',{name:'Transportista *',exact:true})).toContainText('QA Transporte 1');
  await expect(page.getByRole('button',{name:'Vehículo (opcional)',exact:true})).toContainText('QA002ZZ');
  await expect(page.getByRole('button',{name:'Chofer (opcional)',exact:true})).toContainText('QA Segundo');
 }
 await page.getByLabel('Fecha estimada de retiro',{exact:true}).fill('2099-12-25');
 await proof(page,info,'creation-'+role);
 const result=await post(page,'/api/manifiestos',()=>page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201);
 expect(result.manifiesto.estado).toBe('PENDIENTE_APROBACION');return result.manifiesto;
}
for(const creator of ['generador','operador'] as const)test('in-situ proposal: '+creator+' creates; both parties approve before receipt',async({browser},info)=>{
 test.setTimeout(150000);
 const contexts=[],pages={} as Record<'generador'|'operador',Page>,errors:string[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of ['generador','operador'] as const){
   const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(context);
   pages[role]=await context.newPage();pages[role].on('pageerror',e=>errors.push(e.message));await login(pages[role],info,role);
  }
  const page=pages[creator];await page.goto(prefix(info)+'/manifiestos/nuevo');
  if(creator!=='generador')await choose(page,'Generador *',/^QA Generador 1 /);
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await choose(page,'Tipo de Residuo *',/^Y1 - /);await page.getByLabel('Cantidad *',{exact:true}).fill('11');
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await page.getByRole('button',{name:/^En origen/}).click();
  await expect(page.getByRole('button',{name:'Transportista *',exact:true})).toHaveCount(0);
  await expect(page.getByText(/Ambos reciben un aviso y deben aprobar/)).toBeVisible();
  if(creator!=='operador')await choose(page,'Operador / Destino *',/^QA Operador 1 /);
  await page.getByLabel('Fecha prevista de inicio',{exact:true}).fill('2099-12-25');
  const result=await post(page,'/api/manifiestos',()=>page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201),m=result.manifiesto;
  expect(m).toMatchObject({modalidad:'IN_SITU',transportistaId:null,estado:'PENDIENTE_APROBACION'});
  const panel=page.getByRole('region',{name:'Aprobaciones de las partes'});
  await expect(panel).toContainText('0 de 2 aprobaciones');
  await expect(panel.getByLabel(/^Transporte:/)).toHaveCount(0);
  await proof(page,info,'in-situ-created-'+creator);
  await approve(page,m.id,creator);
  await expect(panel).toContainText('1 de 2 aprobaciones');
  await expect(page.getByRole('button',{name:'Confirmar Recepcion In Situ',exact:true})).toHaveCount(0);
  const other=creator==='generador'?'operador':'generador',counterpart=pages[other];
  await counterpart.goto(prefix(info)+'/notificaciones');
  const notice=counterpart.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:m.numero}).filter({hasText:'Manifiesto pendiente de tu aprobación'});
  await expect(notice).toBeVisible();
  await notice.getByRole('button',{name:/^Abrir aviso:/}).click();
  await expect(counterpart).toHaveURL(new RegExp('/manifiestos/'+m.id+'$'));
  await approve(counterpart,m.id,other);
  const operator=pages.operador,operatorPanel=operator.getByRole('region',{name:'Aprobaciones de las partes'});
  await expect(operatorPanel).toContainText('2 de 2 · Aprobado',{timeout:12000});
  const receipt=operator.getByRole('button',{name:'Confirmar Recepcion In Situ',exact:true});
  await expect(receipt).toBeDisabled();
  await post(operator,'/'+m.id+'/iniciar-coordinacion',()=>operatorPanel.getByRole('button',{name:'Iniciar coordinación',exact:true}).click());
  await expect(receipt).toBeEnabled({timeout:12000});
  await proof(operator,info,'in-situ-approved-'+creator);
  const received=await post(operator,'/'+m.id+'/recepcion-insitu',()=>receipt.click());
  expect(received.manifiesto.estado).toBe('RECIBIDO');
  expect(received.manifiesto.fechaRetiro).toBeNull();
  await expect(operator.getByRole('button',{name:'Registrar Tratamiento',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
 }finally{for(const context of contexts)await context.close();}
});
for(const creator of roles)test('ordinary proposal: '+creator+' creates; each party approves, inbox updates, transport starts',async({browser},info)=>{
 const contexts=[],pages={} as Record<Role,Page>,homes={} as Record<Role,string>,errors:string[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of roles){const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(context);const page=await context.newPage();pages[role]=page;page.on('pageerror',e=>errors.push(e.message));await login(page,info,role);homes[role]=page.url();await expect(page.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();}
  if(info.project.name==='app')await expect(pages.transportista.getByRole('region',{name:'Viajes del transportista'})).toBeVisible();
  else await expect(pages.transportista.getByRole('button',{name:'Ir al Viaje',exact:true}).first()).toBeVisible();
  const page=pages[creator],m=await create(page,info,creator);
  await expect(page.getByRole('region',{name:'Aprobaciones de las partes'})).toContainText('0 de 3 aprobaciones');
  const other=roles.find(r=>r!==creator)!;
  // Counterpart stays in its original page, without navigation/reload.
  const live=pages[other].getByRole('region',{name:'Agenda de manifiestos'});
  await expect(live.locator('[data-agenda-row]').first()).toContainText(m.numero,{timeout:12000});
  await expect(live.locator('[data-agenda-row]').first()).toContainText('Te toca aprobar');
  for(const role of roles){
   const reader=pages[role];await reader.bringToFront();
   await reader.getByRole('button',{name:/^Notificaciones(?: \(|$)/}).click();
   const notice=reader.getByRole('region',{name:'Notificaciones recientes'}).getByRole('button').filter({hasText:m.numero});
   await expect(notice).toHaveCount(1,{timeout:12000});
   await expect(notice).toContainText('Manifiesto pendiente de tu aprobación');
   await notice.click();await expect(reader).toHaveURL(new RegExp('/manifiestos/'+m.id+'$'));
   const approval=reader.getByRole('region',{name:'Aprobaciones de las partes'});
   await expect(approval).toContainText('0 de 3 aprobaciones');
   for(const name of ['Generador','Transporte','Operador'])await expect(approval.getByLabel(name+': Pendiente',{exact:true})).toHaveClass(/text-neutral-600/);
   await expect(approval.getByRole('button',{name:'Iniciar coordinación',exact:true})).toHaveCount(0);
   await proof(reader,info,'bell-and-three-pending-'+creator+'-'+role);
  }
  await approve(page,m.id,creator);await page.goto(homes[creator]);
  const agenda=page.getByRole('region',{name:'Agenda de manifiestos'});
  await expect(agenda.locator('[data-agenda-row]').first()).toContainText(m.numero);
  await expect(agenda.locator('[data-agenda-row]').first()).toContainText('En espera');
  await agenda.getByRole('button',{name:'En espera',exact:true}).click();await proof(page,info,'waiting-'+creator);
  const approvedRoles:Role[]=[creator];
  for(const role of roles.filter(r=>r!==creator)){
   const panel=pages[role].getByRole('region',{name:'Aprobaciones de las partes'});
   await expect(panel.getByRole('button',{name:'Iniciar coordinación',exact:true})).toHaveCount(0);
   await approve(pages[role],m.id,role);
   approvedRoles.push(role);
   for(const observer of roles.filter(r=>r!==creator)){
    const reflected=pages[observer].getByRole('region',{name:'Aprobaciones de las partes'});
    for(const actor of roles){
     const label={generador:'Generador',transportista:'Transporte',operador:'Operador'}[actor];
     await expect(reflected.getByLabel(label+': '+(approvedRoles.includes(actor)?'Aprobado':'Pendiente'),{exact:true})).toHaveClass(approvedRoles.includes(actor)?/text-emerald-900/:/text-neutral-600/,{timeout:12000});
    }
    if(approvedRoles.length<3)await expect(reflected.getByRole('button',{name:'Iniciar coordinación',exact:true})).toHaveCount(0);
   }
  }
  await agenda.getByRole('button',{name:'Todos',exact:true}).click();
  await expect(agenda.locator('[data-agenda-row]').first()).toContainText('Listo para iniciar',{timeout:12000});
  await agenda.getByRole('link',{name:new RegExp(m.numero)}).click();
  const panel=page.getByRole('region',{name:'Aprobaciones de las partes'});await expect(panel).toContainText('3 de 3 · Aprobado');
  for(const label of ['Generador','Transporte','Operador'])await expect(panel.getByLabel(label+': Aprobado',{exact:true})).toBeVisible();
  await proof(page,info,'unanimous-'+creator);
  await post(page,'/'+m.id+'/iniciar-coordinacion',()=>panel.getByRole('button',{name:'Iniciar coordinación',exact:true}).click());
  await expect(panel).toContainText('Coordinación iniciada');
  // Verify the complete persisted notice history for every participant,
  // not only the creation notice or the last operator's session.
  const approvalOrder=[creator,...roles.filter(role=>role!==creator)];
  const roleName={generador:'Generador',transportista:'Transporte',operador:'Operador'};
  const stages=['Manifiesto pendiente de tu aprobación',
   ...approvalOrder.slice(0,2).map(role=>roleName[role]+' aprobó su participación'),
   '¡Tres aprobaciones! Listos para iniciar','¡Coordinación iniciada! Preparar el retiro'];
  for(const role of roles){
   const reader=pages[role];await reader.goto(prefix(info)+'/notificaciones');
   const notices=reader.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:m.numero});
   for(const stage of stages)await expect(notices.filter({hasText:stage})).toHaveCount(1);
   await proof(reader,info,'all-stage-notices-'+creator+'-'+role);
   await notices.filter({hasText:'¡Coordinación iniciada! Preparar el retiro'}).getByRole('button',{name:/^Abrir aviso:/}).click();
   await expect(reader).toHaveURL(new RegExp('/manifiestos/'+m.id+'$'));
   const reflected=reader.getByRole('region',{name:'Aprobaciones de las partes'});
   for(const name of ['Generador','Transporte','Operador'])await expect(reflected.getByLabel(name+': Aprobado',{exact:true})).toHaveClass(/text-emerald-900/);
  }
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
  expect(errors).toEqual([]);writeFileSync(info.outputPath('proof.json'),JSON.stringify({creator,id:m.id,numero:m.numero,surface:info.project.name,realLogins:3,cap:false,liveWithoutReload:true,errors}));
 }finally{for(const c of contexts)await c.close();}
});


test('operational proposal manual is available to all three roles, with stable navigation',async({page},info)=>{
 await isolatedMapTiles(page,info);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/manual/tutorial.html?guide=manifiestos-tres-partes');
 await expect(page.locator('#tutorialTitle')).toHaveText('Proponer un manifiesto y aprobar entre las tres partes');
 await expect(page.locator('.guide-step')).toHaveCount(4);
 for(const text of ['Crear no aprueba','Generador firma','3 de 3','Iniciar coordinación','CAP cerrado y correo/push apagados'])await expect(page.locator('body')).toContainText(text);
 if(info.project.name!=='web-desktop')await page.getByRole('button',{name:/Índice del tutorial/}).click();
 await page.locator('#tutorialIndex a').last().click();await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ratio:1});
 await page.reload();await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current','step');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath('manual-proposals.png'),animations:'disabled'});expect(errors).toEqual([]);
});
