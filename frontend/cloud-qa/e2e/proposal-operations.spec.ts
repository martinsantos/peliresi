import {test,expect,devices,type Page,type TestInfo} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {login,prefix,readablePageHeading,isolatedMapTiles} from './helpers';
import {assertCloudDatabase,backendRequire} from '../safety';
import {qaBackendEntry} from '../rollback-backend';
test.beforeAll(async () => { expect(process.env.MANIFEST_PROPOSALS_ENABLED).toBe('true'); await assertCloudDatabase(); });
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
async function markSynthetic(id:string,numero:string){
 const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
 try{
  const m=await db.manifiesto.findUniqueOrThrow({where:{id},include:{generador:{include:{usuario:true}},transportista:{include:{usuario:true}},operador:{include:{usuario:true}}}});
  expect(m.numero).toBe(numero);
  for(const actor of [m.generador,m.transportista,m.operador]){
   expect(actor.razonSocial).toMatch(/^QA /);
   expect(actor.usuario.email).toMatch(/@night-qa\.invalid$/);
  }
  await db.manifiesto.update({where:{id},data:{isDemoData:true}});
 }finally{await db.$disconnect();}
}
// Independently derive scoped company representatives from the synthetic
// registry, rather than assuming exactly one account per participating actor.
async function expectedProposalRecipients(db:any,id:string):Promise<string[]> {
 const manifest=await db.manifiesto.findUniqueOrThrow({where:{id},include:{
  generador:{select:{usuarioId:true}},transportista:{select:{usuarioId:true}},operador:{select:{usuarioId:true}},
 }});
 const representatives=await db.$queryRawUnsafe(`
  SELECT DISTINCT grant_row."usuarioId" FROM manifiestos m
  JOIN empresas_actividades activity ON activity.activa AND (
   (activity.rol='GENERADOR' AND activity."actorId"=m."generadorId") OR
   (activity.rol='TRANSPORTISTA' AND activity."actorId"=m."transportistaId") OR
   (activity.rol='OPERADOR' AND activity."actorId"=m."operadorId"))
  JOIN empresas company ON company.id=activity."empresaId" AND company.activa
  JOIN empresas_autorizaciones grant_row ON grant_row."actividadId"=activity.id AND grant_row."empresaId"=company.id AND grant_row.activa
  JOIN usuarios person ON person.id=grant_row."usuarioId" AND person.activo AND person."emailVerified"
   AND person.rol::text IN ('GENERADOR','TRANSPORTISTA','OPERADOR')
  LEFT JOIN generadores gen ON activity.rol='GENERADOR' AND gen.id=activity."actorId"
  LEFT JOIN transportistas carrier ON activity.rol='TRANSPORTISTA' AND carrier.id=activity."actorId"
  LEFT JOIN operadores op ON activity.rol='OPERADOR' AND op.id=activity."actorId"
  WHERE m.id=$1 AND CASE activity.rol WHEN 'GENERADOR' THEN gen.activo WHEN 'TRANSPORTISTA' THEN carrier.activo ELSE op.activo END
   AND regexp_replace(CASE activity.rol WHEN 'GENERADOR' THEN gen.cuit WHEN 'TRANSPORTISTA' THEN carrier.cuit ELSE op.cuit END,'[^0-9]','','g')=company.cuit
   AND (grant_row."todosEstablecimientos" OR EXISTS (SELECT 1 FROM empresas_establecimientos site
    WHERE site.activo AND site."empresaId"=company.id AND site.id=m."contextoEmpresa"->>'establecimientoId'
     AND m."contextoEmpresa"->>'empresaId'=company.id AND site.id=ANY(grant_row."establecimientoIds")))`,id) as Array<{usuarioId:string}>;
 return [...new Set([manifest.creadoPorId,manifest.generador.usuarioId,manifest.transportista?.usuarioId,manifest.operador.usuarioId,
  ...representatives.map(row=>row.usuarioId)].filter((value):value is string=>Boolean(value)))].sort();
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
  const warning=page.getByRole('alert').filter({hasText:'Ya asignaste vehículo o chofer.'});
  await expect(warning).toBeVisible();
  await expect(page.getByRole('button',{name:/^Con traslado/})).toHaveAttribute('aria-pressed','true');
  await warning.getByRole('button',{name:'Mantener traslado',exact:true}).click();
  await expect(page.getByRole('button',{name:'Transportista *',exact:true})).toContainText('QA Transporte 1');
  await expect(page.getByRole('button',{name:'Vehículo (opcional)',exact:true})).toContainText('QA002ZZ');
  await expect(page.getByRole('button',{name:'Chofer (opcional)',exact:true})).toContainText('QA Segundo');
 }
 await page.getByLabel('Fecha estimada de retiro',{exact:true}).fill('2099-12-25');
 await page.getByLabel('Observaciones',{exact:true}).fill('QA roles UX · datos artificiales');
 await proof(page,info,'creation-'+role);
 const result=await post(page,'/api/manifiestos',()=>page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201);
 expect(result.manifiesto.estado).toBe('PENDIENTE_APROBACION');
 await markSynthetic(result.manifiesto.id,result.manifiesto.numero);return result.manifiesto;
}
for(const creator of roles)test('in-situ proposal: '+creator+' creates; three parties approve without a trip',async({browser},info)=>{
 test.setTimeout(180000);
 const contexts=[],pages={} as Record<Role,Page>,errors:string[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of roles){
   const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(context);
   pages[role]=await context.newPage();pages[role].on('pageerror',e=>errors.push(e.message));
   pages[role].on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
   await login(pages[role],info,role);
  }
  const page=pages[creator];await page.goto(prefix(info)+'/manifiestos/nuevo');
  if(creator!=='generador')await choose(page,'Generador *',/^QA Generador 1 /);
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await choose(page,'Tipo de Residuo *',/^Y1 - /);await page.getByLabel('Cantidad *',{exact:true}).fill('11');
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await page.getByRole('button',{name:/^En origen/}).click();
  if(creator!=='transportista')await choose(page,'Transportista aprobador *',/^QA Transporte 1 /);
  await expect(page.getByText(/Las tres partes reciben un aviso y deben aprobar/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Vehículo (opcional)',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Chofer (opcional)',exact:true})).toHaveCount(0);
  if(creator!=='operador')await choose(page,'Operador / Destino *',/^QA Operador 1 /);
  await page.getByLabel('Fecha prevista de inicio',{exact:true}).fill('2099-12-25');
  await page.getByLabel('Observaciones',{exact:true}).fill('QA roles UX · datos artificiales');
  const result=await post(page,'/api/manifiestos',()=>page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201),m=result.manifiesto;
  expect(m).toMatchObject({modalidad:'IN_SITU',estado:'PENDIENTE_APROBACION'});
  expect(m.transportistaId).toBeTruthy();await markSynthetic(m.id,m.numero);
  for(const role of roles){
   const reader=pages[role];await reader.goto(prefix(info)+'/notificaciones');
   const notice=reader.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:m.numero}).filter({hasText:'Manifiesto pendiente de tu aprobación'});
   await expect(notice).toBeVisible();
   await notice.getByRole('button',{name:/^Abrir aviso:/}).click();
   const manifestUrl=new RegExp('/manifiestos/'+m.id+'$');
   await reader.waitForURL(url=>manifestUrl.test(url.pathname)||/\/notificaciones\/[^/]+$/.test(url.pathname));
   if (/\/notificaciones\/[^/]+$/.test(new URL(reader.url()).pathname)) {
    await expect(reader.getByRole('heading',{name:'Manifiesto pendiente de tu aprobación',exact:true})).toBeVisible();
    const roleName=role==='generador'?'Generador':role==='transportista'?'Transporte':'Operador';
    const selectContext=reader.getByRole('button',{name:new RegExp('^(Usar '+roleName+' y abrir manifiesto|Abrir manifiesto)$')});
    await expect(selectContext).toHaveCount(1);await selectContext.click();
   }
   await expect(reader).toHaveURL(manifestUrl);
   const panel=reader.getByRole('region',{name:'Aprobaciones de las partes'});
   await expect(panel).toContainText('0 de 3 aprobaciones');
   for(const name of ['Generador','Transporte','Operador'])await expect(panel.getByLabel(name+': Pendiente',{exact:true})).toBeVisible();
  }
  await proof(page,info,'in-situ-created-'+creator);
  const order=[creator,...roles.filter(role=>role!==creator)];
  for(let i=0;i<order.length;i++){
   await approve(pages[order[i]],m.id,order[i]);
   if(i<2){
    await expect(pages[order[i]].getByRole('region',{name:'Aprobaciones de las partes'})).toContainText((i+1)+' de 3 aprobaciones');
    await expect(pages[order[i]].getByRole('button',{name:'Iniciar coordinación',exact:true})).toHaveCount(0);
   }
  }
  const operator=pages.operador,operatorPanel=operator.getByRole('region',{name:'Aprobaciones de las partes'});
  await expect(operatorPanel).toContainText('3 de 3 · Aprobado',{timeout:12000});
  for(const name of ['Generador','Transporte','Operador'])await expect(operatorPanel.getByLabel(name+': Aprobado',{exact:true})).toBeVisible();
  const receipt=operator.getByRole('button',{name:'Confirmar recepción en origen',exact:true});
  await expect(receipt).toBeDisabled();
  await post(operator,'/'+m.id+'/iniciar-coordinacion',()=>operatorPanel.getByRole('button',{name:'Iniciar coordinación',exact:true}).click());
  await expect(receipt).toBeEnabled({timeout:12000});await proof(operator,info,'in-situ-approved-'+creator);
  const received=await post(operator,'/'+m.id+'/recepcion-insitu',()=>receipt.click());
  expect(received.manifiesto.estado).toBe('RECIBIDO');expect(received.manifiesto.fechaRetiro).toBeNull();
  await expect(operator.getByRole('button',{name:'Registrar Tratamiento',exact:true})).toBeVisible();
  const transport=pages.transportista;
  await transport.goto(prefix(info)+'/transporte/viaje/'+m.id);
  await expect(transport.getByText('Tratamiento en origen · sin viaje')).toBeVisible();
  await expect(transport.getByText(/no hay retiro ni GPS/)).toBeVisible();
  await proof(transport,info,'in-situ-no-trip-'+creator);
  const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
  try{
   expect(await db.trackingGPS.count({where:{manifiestoId:m.id}})).toBe(0);
   expect(await db.tramoTransporte.count({where:{manifiestoId:m.id}})).toBe(0);
   const notices=await db.notificacion.findMany({where:{manifiestoId:m.id,titulo:'Coordinación iniciada: tratamiento en origen'},
    select:{id:true,datos:true,tipo:true,usuarioId:true,manifiestoId:true,usuario:{select:{id:true,email:true,nombre:true,apellido:true,rol:true,activo:true}}}});
   expect(notices.map((notice:{usuarioId:string})=>notice.usuarioId).sort()).toEqual(await expectedProposalRecipients(db,m.id));
   const {notificationMailContent}=backendRequire(path.join(path.dirname(qaBackendEntry()),'services/notification-mail.service.js'));
   const openedFromMail=new Set<Role>();
   for(const notice of notices){
    const data=JSON.parse(notice.datos);
    expect(data).toMatchObject({fase:'iniciada',modalidad:'IN_SITU',partesRequeridas:3});
    const mail=notificationMailContent({...notice.usuario,...notice});
    expect(mail.subject).toContain('Coordinación en origen iniciada');expect(mail.html).toContain('No hay retiro, viaje ni GPS');
    // Each actor opens its own notice first, so the correct activity can be
    // chosen before reaching a manifest. Inspect URL semantics, not raw HTML:
    // the preferred destination is encoded inside the resolver link.
    const links=await operator.evaluate((html:string)=>{
     const document=new DOMParser().parseFromString(html,'text/html');
     return Object.fromEntries(['preferred','web','app'].map(key=>[key,document.querySelector(`a[data-mail-action="${key}"]`)?.getAttribute('href')]));
    },mail.html);
    const destination='/notificaciones/'+encodeURIComponent(notice.id);
    const preferred=new URL(links.preferred!),web=new URL(links.web!),app=new URL(links.app!);
    for(const link of [preferred,web,app])expect(link.origin).toBe('http://127.0.0.1:4177');
    expect(preferred.pathname).toBe('/app/abrir');expect(preferred.searchParams.get('destino')).toBe(destination);
    expect(web.pathname+web.search+web.hash).toBe(destination);
    expect(app.pathname+app.search+app.hash).toBe('/app'+destination);
    const role=roles.find(item=>notice.usuario.email===`${item}@night-qa.invalid`);
    if(role){
     const reader=pages[role];await reader.goto(preferred.href);
     await expect(reader).toHaveURL(new RegExp('/(?:app/)?notificaciones/'+notice.id+'$'));
     await expect(reader.getByRole('heading',{name:'Coordinación iniciada: tratamiento en origen',exact:true})).toBeVisible();
     const open=reader.getByRole('link',{name:/^Abrir (manifiesto|como)/})
      .or(reader.getByRole('button',{name:/^Abrir (manifiesto|como)/}));
     // A representative can have both a company and a personal activity;
     // verify that the first available choice reaches this manifest.
     await expect(open.first()).toBeVisible();await open.first().click();
     await expect(reader).toHaveURL(new RegExp('/manifiestos/'+m.id+'$'));
     openedFromMail.add(role);
    }
   }
   expect([...openedFromMail].sort()).toEqual([...roles].sort());
  }finally{await db.$disconnect();}
  for(const role of roles){
   const reader=pages[role];await reader.goto(prefix(info)+'/notificaciones');
   const notices=reader.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:m.numero});
   await expect(notices.filter({hasText:'¡Tres aprobaciones! Listos para iniciar'})).toHaveCount(1);
   await expect(notices.filter({hasText:'Coordinación iniciada: tratamiento en origen'})).toHaveCount(1);
   await expect(notices.filter({hasText:'Coordinación iniciada: tratamiento en origen'})).toContainText('No hay retiro, viaje ni GPS');
  }
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('proof.json'),JSON.stringify({creator,id:m.id,numero:m.numero,surface:info.project.name,approvals:3,cap:false,noTripOrGps:true,errors}));
 }finally{for(const context of contexts)await context.close();}
});
for(const creator of roles)test('ordinary proposal: '+creator+' creates; each party approves, inbox updates, transport starts',async({browser},info)=>{
 const contexts=[],pages={} as Record<Role,Page>,homes={} as Record<Role,string>,errors:string[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of roles){const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(context);const page=await context.newPage();pages[role]=page;page.on('pageerror',e=>errors.push(e.message));await login(page,info,role);homes[role]=page.url();await expect(page.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();}
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
 const script=page.locator('script[src^="help-data.js?v="]');
 const url=await script.getAttribute('src');expect(url).not.toBeNull();
 const source=await page.request.get(new URL(url!,page.url()).toString());expect(source.ok()).toBe(true);
 const digest=createHash('sha256').update(await source.body()).digest('hex').slice(0,12);
 expect(url).toBe('help-data.js?v='+digest);
 const steps=page.locator('.guide-step');
 for(const title of ['Crear desde cualquiera de las tres cuentas','Comprobar un envío sin confirmación','Resolver una parte que no puede aprobar','Revisar y decidir desde cada rol','Programar y coordinar el retiro','Confirmar el hecho físico y continuar'])await expect(steps.getByRole('heading',{name:title,exact:true})).toHaveCount(1);
 expect(await page.locator('#tutorialIndex a').count()).toBe(await steps.count());
 for(const text of ['Crear no aprueba','Comprobar un envío sin confirmación','transporte aprobador','Generador firma','3 de 3','Iniciar coordinación','CAP cerrado y correo/push apagados'])await expect(page.locator('body')).toContainText(text);
 if(info.project.name!=='web-desktop')await page.getByRole('button',{name:/Índice del tutorial/}).click();
 await page.locator('#tutorialIndex a').last().click();await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ratio:1});
 await page.reload();await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current','step');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath('manual-proposals.png'),animations:'disabled'});
 await page.goto('/manual/tutorial.html?guide=resolver-espera-reintento');
 await expect(page.locator('#tutorialTitle')).toHaveText('Continuar cuando aparece Esperá un momento');
 for(const text of ['El sistema está ocupado','no se reenvían automáticamente','revisá el estado o el historial'])await expect(page.locator('body')).toContainText(text);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath('manual-espera.png'),animations:'disabled'});expect(errors).toEqual([]);
});

test('a busy approval is explained and only retried after an explicit action',async({browser},info)=>{
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:390,height:844}};
 const operatorContext=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
 const carrierContext=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
 try{
  const operator=await operatorContext.newPage(),carrier=await carrierContext.newPage();
  await login(operator,info,'operador');await login(carrier,info,'transportista');
  const m=await create(operator,info,'operador');
  await carrier.goto(prefix(info)+'/manifiestos/'+m.id);
  const panel=carrier.getByRole('region',{name:'Aprobaciones de las partes'});
  await expect(panel.getByLabel('Transporte: Pendiente',{exact:true})).toBeVisible();
  const endpoint='**/api/manifiestos/'+m.id+'/aprobar-parte';let attempts=0;
  await carrier.route(endpoint,async route=>{attempts++;await route.fulfill({status:503,contentType:'application/json',headers:{'Retry-After':'5'},body:JSON.stringify({success:false,status:503,code:'TRANSACTION_BUSY',retryAfterSeconds:5,message:'El sistema está ocupado. Esperá unos segundos y revisá el estado antes de volver a intentar.'})});});
  await panel.getByRole('button',{name:'Aprobar como transporte',exact:true}).click();
  await expect(panel.getByRole('alert').filter({hasText:'revisá el estado antes de volver a intentar'})).toBeVisible();
  await proof(carrier,info,'approval-busy');
  await panel.getByRole('button',{name:'Actualizar aprobaciones',exact:true}).click();
  await expect(panel.getByLabel('Transporte: Pendiente',{exact:true})).toBeVisible();
  expect(attempts).toBe(1);
  const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
  try{expect(await db.eventoManifiesto.count({where:{manifiestoId:m.id,tipo:'APROBACION_TRANSPORTISTA'}})).toBe(0);}finally{await db.$disconnect();}
  await carrier.unroute(endpoint);
  await post(carrier,'/'+m.id+'/aprobar-parte',()=>panel.getByRole('button',{name:'Aprobar como transporte',exact:true}).click());
  await expect(panel.getByLabel('Transporte: Aprobado',{exact:true})).toBeVisible();
  const verify=new PrismaClient();try{expect(await verify.eventoManifiesto.count({where:{manifiestoId:m.id,tipo:'APROBACION_TRANSPORTISTA'}})).toBe(1);}finally{await verify.$disconnect();}
 }finally{await operatorContext.close();await carrierContext.close();}
});
