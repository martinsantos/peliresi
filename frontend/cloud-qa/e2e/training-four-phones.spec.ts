import {test, expect, devices, type Page, type TestInfo, type BrowserContext, type Locator} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {trainingLogin, publishedTraining} from '../training-login';
import {directTrainingLogin,observedNotificationBody} from '../direct-training-login';
import {prefix, readablePageHeading} from './helpers';

// Four isolated browser contexts, one worker. GPS is browser-emulated; API,
// sessions, persistence, polling and all workflow actions are real UI traffic.
async function dismissLive(page:Page){if(await page.getByRole('dialog').count())return;const close=page.getByRole('button',{name:'Cerrar aviso en vivo',exact:true});for(let i=0;i<50&&await close.isVisible();i++)await close.click();}
async function navigation(page: Page, info: TestInfo, route: string) {
  await dismissLive(page);
  const target = page.locator(`a[href="${prefix(info)}${route}"]:visible`).first();
  const box=await target.count()?await target.boundingBox():null;
  if (!box || box.x < 0 || box.x + box.width > page.viewportSize()!.width) await page.getByRole('button', {name:/^Abrir men[uú]$/}).click();
  await expect(target).toBeVisible(); await target.click();
  await expect(page).toHaveURL(new RegExp(prefix(info) + route + '$'));
}
async function openManifest(page: Page, info: TestInfo, number: string) {
  await navigation(page, info, '/manifiestos');
  await page.getByRole('textbox', {name:'Buscar manifiestos',exact:true}).fill(number);
  const row = page.getByRole('link', {name:number,exact:true});
  await expect(row).toBeVisible(); await row.click();
}
async function choose(page:Page,name:string,value:RegExp){
  await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('option',{name:value}).click();
}
async function proof(page:Page,info:TestInfo,name:string){
  await expect(page).toHaveTitle(/SITREP/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByText('Capacitación · sin validez oficial',{exact:false}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await readablePageHeading(page);
  const contrasts=await page.locator('button[data-ui-button="primary"]:enabled:visible').evaluateAll(buttons=>{
    const luminance=(color:string)=>{const v=(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
    return buttons.map(button=>{const bg=luminance(getComputedStyle(button).backgroundColor),fg=luminance(getComputedStyle(button.querySelector('span')||button).color);return {text:button.textContent,ratio:(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)};});
  });
  for(const item of contrasts)expect(item.ratio,'Button contrast: '+item.text).toBeGreaterThanOrEqual(4.5);

  await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true,animations:'disabled'});
}
async function post(page:Page,suffix:string,action:()=>Promise<unknown>,status=200){
  await dismissLive(page);
  const result=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='POST');
  await action();const response=await result;expect(response.status(),suffix).toBe(status);
  expect(response.headers()['x-sitrep-training']).toBe('true');return {...await response.json(),__command:response.request().postDataJSON()};
}

async function draw(page:Page,area:Locator){
 const canvas=area.locator('canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
 await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();
 for(const [x,y]of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});
 await page.mouse.up();await area.getByRole('button',{name:'Usar firma',exact:true}).click();
}
async function createProposal(page:Page,info:TestInfo,role:string,team:number,futureDays=1){
 await navigation(page,info,'/manifiestos');
 await page.getByRole('button',{name:'Nuevo Manifiesto',exact:true}).click();
 if(role!=='generador')await choose(page,'Generador *',new RegExp('^CAP · Generador '+team));
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await choose(page,'Tipo de Residuo *',/^Y-CAP/);
 await page.getByLabel('Cantidad *',{exact:true}).fill('10');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 if(role!=='transportista')await choose(page,'Transportista *',new RegExp('^CAP · Transporte '+team));
 await choose(page,'Vehículo (opcional)',new RegExp('^CAP00'+team));
 await choose(page,'Chofer (opcional)',new RegExp('^Chofer ficticio '+team));
 if(role!=='operador')await choose(page,'Operador / Destino *',new RegExp('^CAP · Operador '+team));
 const future=new Date(Date.now()+futureDays*86400000).toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Mendoza'});
 await page.getByLabel('Fecha estimada de retiro',{exact:true}).fill(future);
 await proof(page,info,'creation-'+role);
 const created=await post(page,'/api/manifiestos',()=>page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201);
 expect(created.data.manifiesto.estado).toBe('PENDIENTE_APROBACION');
 return created.data.manifiesto;
}
async function approve(page:Page,info:TestInfo,role:string,m:any){
 await openManifest(page,info,m.numero);
 const region=page.getByRole('region',{name:'Aprobaciones de las partes'});
 if(role==='generador'){
  await region.getByRole('button',{name:'Firmar Manifiesto',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Firma del manifiesto',exact:true});await draw(page,dialog);
  await post(page,'/'+m.id+'/firmar',()=>dialog.getByRole('button',{name:'Confirmar y Firmar',exact:true}).click());
 }else await post(page,'/'+m.id+'/aprobar-parte',()=>region.getByRole('button',{name:role==='operador'?'Aprobar como operador':'Aprobar como transporte',exact:true}).click());
}
async function release(page:Page,info:TestInfo,m:any,kind:'parcial'|'final'){
 await dismissLive(page);const area=page.getByRole('region',{name:'Certificaciones'});
 await area.getByRole('button',{name:kind==='parcial'?'Emitir certificación parcial':'Emitir certificación final total',exact:true}).click();
 if(kind==='parcial')await area.getByLabel(/^Cantidad a certificar/).fill('4');
 await expect(area.getByLabel('Método de tratamiento certificado',{exact:true})).not.toHaveValue('');
 await expect(area.getByLabel('Observaciones del certificado (opcional)',{exact:true})).toHaveValue('');
 await dismissLive(page);await draw(page,area);
 const result=await post(page,'/'+m.id+'/documentos-cap',()=>area.getByRole('button',{name:'Firmar y publicar certificación',exact:true}).click(),201);
 const download=page.waitForEvent('download');await area.getByRole('button',{name:kind==='parcial'?'Descargar parcial 1 CAP':'Descargar final CAP',exact:true}).click();
 await (await download).saveAs(info.outputPath('certificado-'+kind+'.pdf'));
 await proof(page,info,'documento-'+kind);return result.__command;
}

test('four independent phones hand off one new manifest and observe actual GPS submissions in C3',async({browser},info)=>{
  const expectedHttp=new Set<string>();
  const contexts:BrowserContext[]=[], pages:Record<string,Page>={},errors:string[]=[],consoleErrors:string[]=[],serverErrors:string[]=[],httpErrors:string[]=[];
  const direct=process.env.QA_TRAINING_DIRECT==='true', team=direct?1:5;
  const scope={manifests:new Set<string>(),eventuals:new Set<string>()};
  const roles=[['admin','Administradores'],['generador','Generadores'],['transportista','Transportistas'],['operador','Operadores']];
  const evidence:any={surface:info.project.name,viewport:'360x800',independentSessions:4,team,gps:'browser-emulated; real UI sends to server',steps:[]};
  const baseURL=publishedTraining?'https://sitrep.ultimamilla.com.ar':'http://127.0.0.1:4177';
  try{
    for(const [role,category]of roles){
      const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:360,height:800},deviceScaleFactor:1,
        baseURL,geolocation:{latitude:-32.89001,longitude:-68.84001},permissions:['geolocation'],serviceWorkers:'block',
        ...(publishedTraining?{proxy:{server:process.env.QA_TRAINING_PROXY!}}:{})});
      context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000);
      contexts.push(context);const page=await context.newPage();pages[role]=page;console.log('Preparing phone',role);
      page.on('pageerror',e=>errors.push(role+': '+e.message));
      if(direct){await directTrainingLogin(page,info,role,scope);}else{
      await trainingLogin(page,info,scope);
      await page.goto(prefix(info)+'/switch-user?modo=capacitacion');
      const group=page.getByRole('region',{name:category,exact:true});
      await expect(group.getByRole('button',{name:/^Ver como CAP/})).toHaveCount(5);
      const selected=page.waitForResponse(r=>r.url().includes('/admin/training/impersonate/')&&r.request().method()==='POST');
      await group.getByRole('button',{name:/^Ver como CAP/}).nth(4).click();expect((await selected).status()).toBe(200);
      await expect(page.getByText('Capacitación · sin validez oficial',{exact:false}).first()).toBeVisible();
      }
      await page.getByRole('button',{name:'Activar sonido',exact:true}).click();
      await expect(page.getByRole('button',{name:'Sonido activo',exact:true})).toBeVisible();
      console.log('Phone ready',role);
      page.on('console',m=>{if(m.type()==='error')consoleErrors.push(role+': '+m.text());});
      page.on('response',r=>{if(r.status()>=400)httpErrors.push(role+': '+r.status()+' '+new URL(r.url()).pathname);if(r.status()>=500)serverErrors.push(role+': '+r.status()+' '+new URL(r.url()).pathname);});
    }
    evidence.steps.push(direct?'four direct role logins without instructor credentials':'four role sessions selected through instructor UI');console.log('All four roles ready');
    const seenNotices:Record<string,Set<string>>={};
    for(const [role,page] of Object.entries(pages)){seenNotices[role]=new Set();page.on('response',async r=>{if(new URL(r.url()).pathname==='/api/notificaciones' && r.status()===200){for(const n of (await observedNotificationBody(r))?.data?.notificaciones||[])if(n.manifiestoId)seenNotices[role].add(n.manifiestoId);}});}
    const {admin,generador,transportista,operador}=pages;
    for(const role of ['admin','operador','transportista']){
      const page=pages[role],agenda=page.getByRole('region',{name:'Agenda de manifiestos',exact:true});
      await expect(agenda).toBeVisible();await expect(agenda.getByRole('button',{name:'En curso',exact:true})).toBeVisible();
      await agenda.getByRole('button',{name:'En curso',exact:true}).click();await expect(agenda.getByRole('button',{name:'En curso',exact:true})).toHaveAttribute('aria-pressed','true');
      await agenda.getByRole('button',{name:'Todos',exact:true}).click();
      await proof(page,info,'agenda-'+role);
    }
    async function api(role:string,id:string,action:string,body:any,status:number){
      if(status>=400)expectedHttp.add(role+': '+status+' /api/manifiestos/'+id+'/'+action);
      const result=await pages[role].evaluate(async({url,body})=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('sitrep_access_token')},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};},{url:'/api/manifiestos/'+id+'/'+action,body});
      expect(result.status,JSON.stringify(result.data)).toBe(status);return result.data;
    }

    let activity:any=null;
    admin.on('response',async r=>{if(r.url().includes('/api/centro-control/actividad')&&r.status()===200)activity=(await r.json()).data;});
    await navigation(admin,info,'/centro-control');
    await admin.getByRole('button',{name:'Hoy',exact:true}).click();
    // Every origin is exercised through the real form. The other three proposals
    // remain future approved appointments; the operator-created case completes the trip.
    for(const origin of ['admin','generador','transportista']){
      const m=await createProposal(pages[origin],info,origin,team);
      evidence.steps.push('created by '+origin+': '+m.numero);
      for(const role of ['generador','operador','transportista'])await approve(pages[role],info,role,m);
      // A phone already on this list refreshes its agenda every 15 seconds.
      for(const role of ['generador','operador','transportista','admin']){
        await navigation(pages[role],info,'/manifiestos');
        const schedule=pages[role].locator('details[aria-label="Próximos retiros"]');if(await schedule.getAttribute('open')===null)await schedule.locator('summary').click();
        await schedule.getByLabel('Buscar manifiesto programado',{exact:true}).fill(m.numero);
        await expect(schedule.getByRole('link').filter({hasText:m.numero})).toBeVisible({timeout:20000});
      }
    }
    const rejected=await createProposal(operador,info,'operador',team);
    await openManifest(generador,info,rejected.numero);
    await generador.getByText('No puedo participar / rechazar',{exact:true}).click();
    await generador.getByLabel('Motivo del rechazo',{exact:true}).fill('Fecha no acordada en la práctica');
    await post(generador,'/'+rejected.id+'/aprobar-parte',()=>generador.getByRole('button',{name:'Rechazar mi participación',exact:true}).click());
    await openManifest(operador,info,rejected.numero);
    await expect(operador.getByText(/Propuesta rechazada: Fecha no acordada/)).toBeVisible();
    await expect(operador.getByRole('button',{name:'Aprobar como operador',exact:true})).toHaveCount(0);
    evidence.steps.push('independent rejection preserves reason and blocks further approvals');
    const manifest=await createProposal(operador,info,'operador',team,0);evidence.manifest={id:manifest.id,numero:manifest.numero};
    for(const role of ['generador','transportista']){
      await expect.poll(()=>seenNotices[role].has(manifest.id),{timeout:45000}).toBe(true);
      const live=pages[role].getByRole('complementary',{name:'Avisos en vivo'});
      await expect(live).toContainText(manifest.numero,{timeout:15000});
      await proof(pages[role],info,'ping-'+role);
      await live.getByRole('button',{name:'Abrir manifiesto',exact:true}).click();
      await expect(pages[role]).toHaveURL(new RegExp('/manifiestos/'+manifest.id+'$'));
      await proof(pages[role],info,'aviso-'+role);
    }
    await approve(generador,info,'generador',manifest);
    await approve(operador,info,'operador',manifest);
    await openManifest(transportista,info,manifest.numero);
    await expect(transportista.getByRole('region',{name:'Aprobaciones de las partes'})).toContainText('Falta aprobar: Transporte');
    await expect(transportista.getByRole('button',{name:'Confirmar retiro',exact:true})).toHaveCount(0);
    await api('transportista',manifest.id,'confirmar-retiro',{},409);
    await api('admin',manifest.id,'aprobar-parte',{},403);
    await approve(transportista,info,'transportista',manifest);
    await api('transportista',manifest.id,'confirmar-retiro',{},409);
    await api('admin',manifest.id,'iniciar-coordinacion',{},403);
    await openManifest(operador,info,manifest.numero);await dismissLive(operador);
    await post(operador,'/'+manifest.id+'/iniciar-coordinacion',()=>operador.getByRole('button',{name:'Iniciar coordinación',exact:true}).click());
    await expect(operador.getByLabel('Tiempo de coordinación',{exact:true})).toBeVisible();
    await api('operador',manifest.id,'iniciar-coordinacion',{},200);
    await expect.poll(async()=>{const r=await operador.evaluate(async(id)=>{const r=await fetch('/api/manifiestos/'+id,{headers:{Authorization:'Bearer '+localStorage.getItem('sitrep_access_token')}});return (await r.json()).data.manifiesto;},manifest.id);return {estado:r.estado,inicios:r.eventos.filter((e:any)=>e.tipo==='INICIO_COORDINACION_CAP').length};}).toEqual({estado:'APROBADO',inicios:1});
    evidence.steps.push('coordination starts explicitly, idempotently, without asserting pickup');
    evidence.steps.push('operator creates; related accounts receive actionable notices; three independent approvals before pickup');
    await navigation(admin,info,'/centro-control');await admin.getByRole('button',{name:'Hoy',exact:true}).click();
    await openManifest(transportista,info,manifest.numero);
    await expect(transportista).toHaveURL(new RegExp('/transporte/viaje/'+manifest.id+'$'));
    await proof(transportista,info,'02-transporte-retiro');
    let gpsPosts=0;
    transportista.on('response',r=>{if(r.url().endsWith('/'+manifest.id+'/ubicacion')&&r.status()===200)gpsPosts++;});
    await dismissLive(transportista);await post(transportista,'/'+manifest.id+'/confirmar-retiro',()=>transportista.getByRole('button',{name:'Confirmar retiro',exact:true}).click());
    await expect(transportista.getByText('GPS activo',{exact:true})).toBeVisible();
    await expect.poll(()=>gpsPosts,{timeout:45000}).toBeGreaterThan(0);
    await expect.poll(()=>activity?.enTransito?.find((m:any)=>m.manifiestoId===manifest.id)?.ultimaPosicion?.latitud,{timeout:45000}).toBeCloseTo(-32.89001,5);
    const agenda=admin.getByRole('region',{name:'Agenda y viajes',exact:true});
    const active=agenda.getByRole('button',{name:/^Viajes Activos/});
    if(await active.getAttribute('aria-expanded')==='false')await active.click();
    await agenda.getByPlaceholder('Buscar por número o transportista...').fill(manifest.numero);
    const trip=agenda.getByRole('button',{name:'Seleccionar viaje '+manifest.numero,exact:true});await trip.click();
    await expect(trip).toHaveAttribute('aria-expanded','true');
    const firstSync=gpsPosts;
    await transportista.context().setGeolocation({latitude:-32.89123,longitude:-68.84123,accuracy:8});
    await expect.poll(()=>gpsPosts,{timeout:45000}).toBeGreaterThan(firstSync);
    await expect.poll(()=>activity?.enTransito?.find((m:any)=>m.manifiestoId===manifest.id)?.ultimaPosicion?.latitud,{timeout:45000}).toBeCloseTo(-32.89123,5);
    await expect.poll(()=>activity?.enTransito?.find((m:any)=>m.manifiestoId===manifest.id)?.ruta?.length||0,{timeout:10000}).toBeGreaterThanOrEqual(2);
    await proof(transportista,info,'03-transporte-gps');await proof(admin,info,'04-admin-c3-viaje');
    evidence.steps.push('transport browser sends two GPS positions; administrator polling observes both and route');evidence.gpsPosts=gpsPosts;
    await agenda.getByRole('button',{name:'Ver detalle del viaje',exact:true}).click();
    await expect(admin).toHaveURL(new RegExp(prefix(info)+'/manifiestos/'+manifest.id+'$'));
    await expect(admin.getByText(manifest.numero,{exact:true}).first()).toBeVisible();
    // Hold one real GPS request in flight: delivery must wait, not race its state change.
    let releaseGps!:()=>void;let gpsHeld=false,deliveryRequests=0;
    const gpsGate=new Promise<void>(resolve=>{releaseGps=resolve;});
    const gpsPattern='**/api/manifiestos/'+manifest.id+'/ubicacion';
    await transportista.route(gpsPattern,async route=>{gpsHeld=true;await gpsGate;await route.fallback();});
    await expect.poll(()=>gpsHeld,{timeout:45000}).toBe(true);
    transportista.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/'+manifest.id+'/confirmar-entrega'))deliveryRequests++;});
    await transportista.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
    await expect(transportista.getByRole('dialog',{name:'Confirmar Entrega?',exact:true})).toBeVisible();
    const delivered=post(transportista,'/'+manifest.id+'/confirmar-entrega',()=>transportista.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click());
    try{
      await expect(transportista.getByRole('button',{name:'Confirmando...',exact:true})).toBeDisabled();
      await new Promise(resolve=>setTimeout(resolve,500));
      expect(deliveryRequests).toBe(0);
    }finally{releaseGps();}
    await delivered;await transportista.unroute(gpsPattern);
    evidence.steps.push('delivery waits for an in-flight GPS write; no GPS writes after delivery');
    await openManifest(operador,info,manifest.numero);
    await post(operador,'/'+manifest.id+'/confirmar-recepcion',()=>operador.getByRole('button',{name:'Confirmar Recepcion',exact:true}).click());
    await operador.getByRole('button',{name:'Registrar Pesaje',exact:true}).click();
    const weighing=operador.getByRole('dialog',{name:'Registrar Pesaje',exact:true});
    await weighing.getByPlaceholder('Peso real',{exact:true}).fill('10');
    await post(operador,'/'+manifest.id+'/pesaje',()=>weighing.getByRole('button',{name:'Confirmar Pesaje',exact:true}).click());
    await proof(operador,info,'05-operador-recibido-pesado');
    await operador.getByRole('button',{name:'Registrar Tratamiento',exact:true}).click();
    const treatment=operador.getByRole('dialog',{name:'Registrar Tratamiento',exact:true});
    await treatment.getByPlaceholder('Observaciones del tratamiento...').fill('CAP: cuatro teléfonos, tratamiento ficticio');
    await post(operador,'/'+manifest.id+'/tratamiento',()=>treatment.getByRole('button',{name:'Confirmar Tratamiento',exact:true}).click());
    await expect(operador.getByRole('button',{name:'Emitir certificación final total',exact:true})).toBeDisabled();
    const partial=await release(operador,info,manifest,'parcial');
    await api('operador',manifest.id,'documentos-cap',partial,201);
    await api('operador',manifest.id,'documentos-cap',{...partial,id:crypto.randomUUID(),cantidades:partial.cantidades.map((r:any)=>({...r,cantidad:7}))},409);
    const finalBody={...partial,id:crypto.randomUUID(),tipo:'FINAL',cantidades:partial.cantidades.map((r:any)=>({...r,cantidad:10}))};
    await api('operador',manifest.id,'documentos-cap',finalBody,409);
    await api('generador',manifest.id,'documentos-cap',finalBody,403);
    await operador.goto(prefix(info)+'/manifiestos/'+manifest.id+'/adendas');
    await operador.getByRole('button',{name:'Registrar diferencia',exact:true}).click();
    await expect(operador.getByLabel('Corriente observada 1',{exact:true})).toHaveAttribute('inputmode','text');
    await expect(operador.getByLabel('Motivo de la adenda',{exact:true})).toHaveAttribute('inputmode','text');
    await operador.getByLabel('Corriente observada 1',{exact:true}).fill('Y1');
    await operador.getByLabel('Cantidad observada 1',{exact:true}).fill('12');
    await operador.getByLabel('Motivo de la adenda',{exact:true}).fill('CAP: diferencia documental; conservar 10 kg declarados y recibidos.');
    const added=await post(operador,'/'+manifest.id+'/adendas',()=>operador.getByRole('button',{name:'Guardar y solicitar revisión',exact:true}).click(),201);
    const adenda=added.data.adenda;
    await expect(operador.getByRole('button',{name:'Aprobar post facto',exact:true})).toHaveCount(0);
    await openManifest(operador,info,manifest.numero);

    await post(operador,'/'+manifest.id+'/cerrar',()=>operador.getByRole('button',{name:'Cerrar Manifiesto',exact:true}).click());
    await api('operador',manifest.id,'documentos-cap',finalBody,409);
    await generador.goto(prefix(info)+'/manifiestos/'+manifest.id+'/adendas');
    await generador.getByLabel('Motivo de resolución',{exact:true}).fill('CAP: diferencia revisada; original y pesaje conservados.');
    await post(generador,'/'+adenda.id+'/revisiones',()=>generador.getByRole('button',{name:'Aprobar post facto',exact:true}).click());
    await expect(generador.getByText('Y-CAP · 10 kg',{exact:true})).toBeVisible();
    await expect(generador.getByText('Y1 · 12 kg',{exact:true})).toBeVisible();
    await proof(generador,info,'adenda-resuelta');
    await release(operador,info,manifest,'final');
    await api('operador',manifest.id,'documentos-cap',{...partial,id:crypto.randomUUID()},409);
    await api('operador',manifest.id,'adendas',{...added.__command,id:crypto.randomUUID()},409);
    evidence.steps.push('partial 4 kg signed; retry idempotent; excess, premature final, non-operator and pending addenda denied; counterpart resolves without changing original; operator releases final 10 kg');

    await expect(admin.getByText('Tratado',{exact:true}).first()).toBeVisible({timeout:35000});
    for(const role of ['generador','transportista','operador','admin']){
      await openManifest(pages[role],info,manifest.numero);
      await expect(pages[role].getByRole('button',{name:'Descargar Certificado',exact:true})).toHaveCount(0);
      await expect(pages[role].getByText('Tratado',{exact:true}).first()).toBeVisible();
      await expect(pages[role].getByRole('button',{name:'Descargar final CAP',exact:true})).toBeVisible();
      await expect(pages[role].getByRole('button',{name:'Descargar parcial 1 CAP',exact:true})).toBeVisible();
      if(role==='admin')await expect(pages[role].getByRole('button',{name:'Revertir Estado',exact:true})).toHaveCount(0);
      await proof(pages[role],info,'06-cierre-'+role);
    }
    await navigation(admin,info,'/centro-control');
    await expect.poll(()=>activity?.enTransito?.some((m:any)=>m.manifiestoId===manifest.id),{timeout:45000}).toBe(false);
    for(const [role]of roles){
      const id=await pages[role].evaluate(()=>JSON.parse(atob(localStorage.getItem('sitrep_access_token')!.split('.')[1])).id);
      expect(id).toBe('cap-20261012-'+role+'-'+team);
    }
    evidence.steps.push('delivery, reception, weighing, treatment and closure; four parties see treated; trip leaves active C3');
    expect(errors).toEqual([]);expect(serverErrors).toEqual([]);
    expect(consoleErrors.filter(e=>/Cannot update a component|Rendered (?:more|fewer) hooks/.test(e))).toEqual([]);
    expect(httpErrors.filter(error => !expectedHttp.has(error) && !/403 \/api\/(?:push\/vapid-key$|blockchain\/manifiesto\/)/.test(error))).toEqual([]);
    if(info.project.name==='web-phone'){await generador.setViewportSize({width:1280,height:800});await proof(generador,info,'desktop-certificaciones');}
    evidence.status='passed';
  }finally{
    for(const [role,page]of Object.entries(pages)){if(!page.isClosed()){await page.screenshot({path:info.outputPath('last-'+role+'.png'),fullPage:true,animations:'disabled'}).catch(()=>{});writeFileSync(info.outputPath('last-'+role+'.txt'),await page.locator('body').innerText().catch(()=>''));}}
    evidence.createdManifestIds=[...scope.manifests];evidence.errors=errors;evidence.consoleErrors=consoleErrors;evidence.serverErrors=serverErrors;evidence.httpErrors=httpErrors;
    writeFileSync(info.outputPath('four-phones-evidence.json'),JSON.stringify(evidence,null,2));
    for(const context of contexts)await context.close().catch(()=>{});
  }
});
