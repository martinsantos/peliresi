import {test, expect, devices, type Page, type TestInfo, type BrowserContext} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {trainingLogin, publishedTraining} from '../training-login';
import {directTrainingLogin} from '../direct-training-login';
import {prefix, readablePageHeading} from './helpers';

// Four isolated browser contexts, one worker. GPS is browser-emulated; API,
// sessions, persistence, polling and all workflow actions are real UI traffic.
async function navigation(page: Page, info: TestInfo, route: string) {
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
  await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true,animations:'disabled'});
}
async function post(page:Page,suffix:string,action:()=>Promise<unknown>,status=200){
  const result=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='POST');
  await action();const response=await result;expect(response.status(),suffix).toBe(status);
  expect(response.headers()['x-sitrep-training']).toBe('true');return response.json();
}

test('four independent phones hand off one new manifest and observe actual GPS submissions in C3',async({browser},info)=>{
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
      console.log('Phone ready',role);
      page.on('console',m=>{if(m.type()==='error')consoleErrors.push(role+': '+m.text());});
      page.on('response',r=>{if(r.status()>=400)httpErrors.push(role+': '+r.status()+' '+new URL(r.url()).pathname);if(r.status()>=500)serverErrors.push(role+': '+r.status()+' '+new URL(r.url()).pathname);});
    }
    evidence.steps.push(direct?'four direct role logins without instructor credentials':'four role sessions selected through instructor UI');console.log('All four roles ready');
    const {admin,generador,transportista,operador}=pages;
    let activity:any=null;
    admin.on('response',async r=>{if(r.url().includes('/api/centro-control/actividad')&&r.status()===200)activity=(await r.json()).data;});
    await navigation(admin,info,'/centro-control');
    await admin.getByRole('button',{name:'Hoy',exact:true}).click();
    await navigation(generador,info,'/manifiestos');
    await generador.getByRole('button',{name:'Nuevo Manifiesto',exact:true}).click();
    await generador.getByRole('button',{name:'Siguiente',exact:true}).click();
    await choose(generador,'Tipo de Residuo *',/^Y-CAP/);
    await generador.getByLabel('Cantidad *',{exact:true}).fill('10');
    await generador.getByRole('button',{name:'Siguiente',exact:true}).click();
    await choose(generador,'Transportista *',new RegExp('^CAP · Transporte '+team));
    await choose(generador,'Vehículo (opcional)',new RegExp('^CAP00'+team));
    await choose(generador,'Chofer (opcional)',new RegExp('^Chofer ficticio '+team));
    await choose(generador,'Operador / Destino *',new RegExp('^CAP · Operador '+team));
    await proof(generador,info,'01-generador-flota');
    const created=await post(generador,'/api/manifiestos',()=>generador.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201);
    const manifest=created.data.manifiesto;evidence.manifest={id:manifest.id,numero:manifest.numero};
    await expect(generador).toHaveURL(new RegExp('/manifiestos/'+manifest.id+'$'));
    await generador.getByRole('button',{name:'Firmar Manifiesto',exact:true}).click();
    const signature=generador.getByRole('dialog',{name:'Firma del manifiesto',exact:true});
    const canvas=signature.locator('canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
    await generador.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await generador.mouse.down();
    for(const [x,y]of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await generador.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});
    await generador.mouse.up();await signature.getByRole('button',{name:'Usar firma',exact:true}).click();
    await post(generador,'/'+manifest.id+'/firmar',()=>signature.getByRole('button',{name:'Confirmar y Firmar',exact:true}).click());
    evidence.steps.push('generator creates and signs with registered vehicle and driver');
    await openManifest(transportista,info,manifest.numero);
    await expect(transportista).toHaveURL(new RegExp('/transporte/viaje/'+manifest.id+'$'));
    await proof(transportista,info,'02-transporte-retiro');
    let gpsPosts=0;
    transportista.on('response',r=>{if(r.url().endsWith('/'+manifest.id+'/ubicacion')&&r.status()===200)gpsPosts++;});
    await post(transportista,'/'+manifest.id+'/confirmar-retiro',()=>transportista.getByRole('button',{name:'Confirmar retiro',exact:true}).click());
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
    await transportista.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
    await post(transportista,'/'+manifest.id+'/confirmar-entrega',()=>transportista.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click());
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
    await post(operador,'/'+manifest.id+'/cerrar',()=>operador.getByRole('button',{name:'Cerrar Manifiesto',exact:true}).click());
    await expect(admin.getByText('Tratado',{exact:true}).first()).toBeVisible({timeout:35000});
    for(const role of ['generador','transportista','operador','admin']){
      await openManifest(pages[role],info,manifest.numero);
      await expect(pages[role].getByRole('button',{name:'Descargar Certificado',exact:true})).toBeDisabled();
      await expect(pages[role].getByText('Tratado',{exact:true}).first()).toBeVisible();
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
    expect(httpErrors.filter(error => !/403 \/api\/(?:push\/vapid-key$|blockchain\/manifiesto\/)/.test(error))).toEqual([]);
    evidence.status='passed';
  }finally{
    for(const [role,page]of Object.entries(pages)){if(!page.isClosed()){await page.screenshot({path:info.outputPath('last-'+role+'.png'),fullPage:true,animations:'disabled'}).catch(()=>{});writeFileSync(info.outputPath('last-'+role+'.txt'),await page.locator('body').innerText().catch(()=>''));}}
    evidence.errors=errors;evidence.consoleErrors=consoleErrors;evidence.serverErrors=serverErrors;evidence.httpErrors=httpErrors;
    writeFileSync(info.outputPath('four-phones-evidence.json'),JSON.stringify(evidence,null,2));
    for(const context of contexts)await context.close().catch(()=>{});
  }
});
