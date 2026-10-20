import {test,expect,type Page,type TestInfo,type BrowserContext} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {isolatedMapTiles,prefix} from './helpers';
const fixture=()=>JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'review-private.json'),'utf8'));
async function login(page:Page,info:TestInfo,role='origin'){
 const data=fixture();await isolatedMapTiles(page,info);
 await page.context().addCookies([{name:'sitrep_qa_client',value:`127.11.${10+info.workerIndex}.${20+info.testId.length}`,url:'http://127.0.0.1:4177'}]);
 await page.addInitScript(()=>{for(const role of ['TRANSPORTISTA','GENERADOR','OPERADOR','ADMIN'])localStorage.setItem('sitrep_onboarding_'+role,'true');});
 await page.goto(prefix(info)+'/login');await page.getByLabel('Correo electrónico o CUIT').fill(data.users[role].email);await page.getByLabel('Contraseña',{exact:true}).fill(data.password);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'Ingresar',exact:true}).click();expect((await response).status()).toBe(200);await expect(page).not.toHaveURL(/\/login$/);
 const skip=page.getByRole('button',{name:'Saltar introducción',exact:true});if(await skip.isVisible())await skip.click();
}
async function proof(page:Page,info:TestInfo,name:string){
 await expect(page).toHaveTitle(/SITREP/);await expect(page.locator('main')).not.toBeEmpty();await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'No horizontal page overflow: '+name).toBeLessThanOrEqual(1);
 const measureContrast=()=>page.locator('button[data-ui-button="primary"]:enabled:visible').evaluateAll(buttons=>{
  const luminance=(color:string)=>{const raw=(color.match(/[\d.]+/g)||[]).map(Number);if(raw.length>3&&raw[3]!==1)return null;const v=raw.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
  return buttons.flatMap(button=>{const bg=luminance(getComputedStyle(button).backgroundColor),fg=luminance(getComputedStyle(button.querySelector('span')||button).color);return bg===null||fg===null?[]:[{text:button.textContent,ratio:(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)}];});
 });
 // Enabled/disabled colors transition for 150 ms. Require the same contrast
 // after the rendered state settles, rather than sampling an intermediate frame.
 await page.locator('button[data-ui-button="primary"]:enabled:visible').evaluateAll(buttons=>Promise.all(buttons.flatMap(button=>button.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))));
 await expect.poll(async()=>Math.min(...(await measureContrast()).map(item=>item.ratio)),{timeout:2000,message:'Primary actions settle at WCAG text contrast >= 4.5:1'}).toBeGreaterThanOrEqual(4.5);
 const contrasts=await measureContrast();
 for(const item of contrasts)expect(item.ratio,'Primary action contrast: '+item.text).toBeGreaterThanOrEqual(4.5);
 writeFileSync(info.outputPath(name+'-geometry.json'),JSON.stringify({url:page.url(),title:await page.title(),contrasts},null,2));
 await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
}
async function context(browser:any,info:TestInfo):Promise<BrowserContext>{return browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,isMobile:!!info.project.use.isMobile,hasTouch:!!info.project.use.hasTouch,deviceScaleFactor:1,serviceWorkers:'block',timezoneId:'America/Argentina/Mendoza',geolocation:{latitude:-33.3,longitude:-68.95},permissions:['geolocation']});}

test('lists preserve phase, pagination, role actions and completed records',async({browser},info)=>{
 const data=fixture(),set=data.cases[info.project.name],errors:string[]=[];
 for(const role of ['origin','operator','generator','admin']){
  const ctx=await context(browser,info),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await login(page,info,role);await page.goto(prefix(info)+'/manifiestos');await page.getByRole('textbox',{name:'Buscar manifiestos',exact:true}).fill(set.prefix);
   const nav=page.getByRole('navigation',{name:'Etapa de los manifiestos',exact:true});
   for(const [label,expectedStates]of [['Por iniciar',['BORRADOR','APROBADO']],['En curso',['EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO']],['Terminados',['TRATADO','RECHAZADO','CANCELADO']]] as const){
    await nav.getByRole('button',{name:label,exact:true}).click();await expect(nav.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
    for(const state of expectedStates)await expect(page.getByRole('link',{name:set.records[state].numero,exact:true})).toBeVisible();
    for(const state of ['BORRADOR','APROBADO','EN_TRANSITO','ENTREGADO','TRATADO','RECHAZADO','CANCELADO'])if(!(expectedStates as readonly string[]).includes(state))await expect(page.getByRole('link',{name:set.records[state].numero,exact:true})).toHaveCount(0);
    await proof(page,info,'list-'+role+'-'+label.replaceAll(' ','-'));
    if(label==='Terminados')await expect(page.getByRole('button',{name:/^Editar manifiesto /})).toHaveCount(0);
   }
   await expect(page.getByRole('button',{name:/^Nuevo manifiesto$/i})).toHaveCount(role==='origin'||role==='operator'?0:1);
   await expect(page.locator('header').getByRole('button',{name:'Ayuda y soporte técnico',exact:true})).toBeVisible();
   await nav.getByRole('button',{name:'Todos',exact:true}).click();
   const last=page.getByRole('link',{name:set.bulk.at(-1).numero,exact:true});
   for(let i=0;i<6&&!await last.count();i++){
    const loaded=page.waitForResponse(r=>r.url().includes('/api/manifiestos?')&&r.url().includes('page=')&&r.status()===200,{timeout:7000}).catch(()=>null);
    if(info.project.name==='web')await page.locator('div.overflow-y-auto.rounded-xl:visible').last().evaluate(el=>{el.scrollTop=el.scrollHeight;});
    else await page.locator('main').evaluate(el=>{if(el.scrollHeight>el.clientHeight)el.scrollTop=el.scrollHeight;else window.scrollTo(0,document.documentElement.scrollHeight);});
    await loaded;
   }
   await expect(last).toBeVisible();
   await page.getByRole('textbox',{name:'Buscar manifiestos',exact:true}).fill(set.records.TRATADO.numero);await expect(page.getByRole('link',{name:set.records.TRATADO.numero,exact:true})).toBeVisible();await expect(page.getByRole('link',{name:set.bulk.at(-1).numero,exact:true})).toHaveCount(0);
   await page.getByRole('textbox',{name:'Buscar manifiestos',exact:true}).fill('QA-SIN-RESULTADOS');await expect(page.getByText('No se encontraron manifiestos',{exact:true})).toBeVisible();
   await proof(page,info,'empty-list-'+role);
   if(role==='generator'||role==='admin'){
    await page.getByRole('button',{name:'Nuevo Manifiesto',exact:true}).click();await expect(page).toHaveURL(new RegExp('/manifiestos/nuevo$'));await expect(page.getByRole('button',{name:'Siguiente',exact:true})).toBeVisible();
   }
  }finally{await ctx.close();}
 }
 expect(errors).toEqual([]);
});

test('driver can choose concurrent trips, pick up, pause, resume and deliver without redirecting to another trip',async({browser},info)=>{
 const data=fixture(),set=data.cases[info.project.name],ctx=await context(browser,info),page=await ctx.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await login(page,info);const home=page.url();await expect(page.getByRole('region',{name:'Agenda de manifiestos',exact:true})).toHaveCount(0);
  await page.goto(prefix(info)+'/transporte/perfil');const queue=page.getByRole('region',{name:'Viajes del transportista',exact:true});
  for(const record of [set.records.EN_TRANSITO,set.records.second])await expect(queue.getByRole('button',{name:'Ir al viaje '+record.numero,exact:true})).toBeVisible();
  const handoffs=page.getByRole('region',{name:'Relevos a mi cargo',exact:true});await expect(handoffs).toBeVisible();
  const ownBox=await queue.boundingBox(),handoffBox=await handoffs.boundingBox();expect(ownBox).not.toBeNull();expect(handoffBox).not.toBeNull();
  expect(ownBox!.y+ownBox!.height,'Own active and pending trips precede the assigned handoffs').toBeLessThanOrEqual(handoffBox!.y);
  await expect(queue.getByRole('heading',{name:/^En tránsito:/})).toBeInViewport();
  await proof(page,info,'driver-trip-queue');
  await queue.getByRole('button',{name:'Abrir viaje asignado '+set.records.pickup.numero,exact:true}).click();await expect(page).toHaveURL(new RegExp('/transporte/viaje/'+set.records.pickup.id+'$'));
  const pickup=page.waitForResponse(r=>r.url().endsWith('/'+set.records.pickup.id+'/confirmar-retiro')&&r.request().method()==='POST');await page.getByRole('button',{name:'Confirmar retiro',exact:true}).click();expect((await pickup).status()).toBe(200);
  await expect(page.getByText('Tiempo transcurrido desde el retiro',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Pausar',exact:true}).click();await expect(page.getByRole('button',{name:'Reanudar',exact:true})).toBeVisible();await proof(page,info,'driver-paused');
  const clock=page.getByText(/^\d{2}:\d{2}:\d{2}$/).first(),pausedTime=await clock.textContent();
  await expect(clock,'Elapsed time since pickup remains informative while the vehicle is paused').not.toHaveText(pausedTime!,{timeout:4500});
  await page.reload();await expect(page.getByRole('button',{name:'Reanudar',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reanudar',exact:true}).click();await expect(page.getByRole('button',{name:'Pausar',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Ver todos mis viajes',exact:true}).click();await expect(page).toHaveURL(new RegExp('/transporte/perfil$'));
  await page.getByRole('button',{name:'Ir al viaje '+set.records.second.numero,exact:true}).click();await expect(page).toHaveURL(new RegExp('/transporte/viaje/'+set.records.second.id+'$'));
  await page.getByRole('link',{name:'Ver todos mis viajes',exact:true}).click();await page.getByRole('button',{name:'Ir al viaje '+set.records.pickup.numero,exact:true}).click();
  await page.getByRole('button',{name:'Confirmar entrega',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Confirmar Entrega?',exact:true});await expect(dialog).toBeVisible();
  const delivered=page.waitForResponse(r=>r.url().endsWith('/'+set.records.pickup.id+'/confirmar-entrega')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();expect((await delivered).status()).toBe(200);
  await page.goto(prefix(info)+'/transporte/perfil');await page.getByRole('button',{name:'Historial',exact:true}).first().click();await expect(page.getByText('#'+set.records.pickup.numero,{exact:true})).toBeVisible();await expect(page.getByText('#'+set.records.CANCELADO.numero,{exact:true})).toHaveCount(0);await proof(page,info,'driver-delivered-history');
  await page.goto(home);await expect(page).toHaveURL(home);expect(errors).toEqual([]);
 }finally{await ctx.close();}
});

test('multiple GPS handles a denied sensor, single-action retry and clearing a load without claiming delivery',async({browser},info)=>{
 const data=fixture(),set=data.cases[info.project.name],ctx=await context(browser,info),page=await ctx.newPage(),errors:string[]=[],sent:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=navigator.geolocation.watchPosition.bind(navigator.geolocation),clear=navigator.geolocation.clearWatch.bind(navigator.geolocation),qa=window as any;qa.qaDeny=true;qa.qaWatchCalls=0;qa.qaWatchIds=new Set<number>();navigator.geolocation.watchPosition=(success,error,options)=>{qa.qaWatchCalls++;let id:number;if(qa.qaDeny){queueMicrotask(()=>error?.({code:1,message:'QA denied sensor',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3}));id=99999;}else id=original(success,error,options);qa.qaWatchIds.add(id);return id;};navigator.geolocation.clearWatch=id=>{qa.qaWatchIds.delete(id);clear(id);};});
 page.on('response',r=>{if(r.request().method()==='POST'&&r.url().endsWith('/ubicacion')&&r.status()===200)sent.push(r.url());});
 try{
  await login(page,info);await page.goto(prefix(info)+'/transporte/cargas');await page.getByRole('searchbox',{name:'Número de manifiesto',exact:true}).fill(set.records.permission.numero);await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.getByRole('checkbox',{name:'Llevo '+set.records.permission.numero+' en este móvil',exact:true}).check();
  await page.getByRole('button',{name:'Iniciar GPS',exact:true}).click();await expect(page.getByText('Permití la ubicación del teléfono y tocá Reintentar GPS.',{exact:true})).toBeVisible();expect(sent).toHaveLength(0);await expect(page.getByRole('button',{name:'Detener GPS',exact:true})).toHaveCount(0);await proof(page,info,'gps-denied-clear-message');
  await page.evaluate(()=>{(window as any).qaDeny=false;});await page.getByRole('button',{name:'Reintentar GPS',exact:true}).click();await expect.poll(()=>sent.length).toBe(1);await expect(page.getByRole('region',{name:'Cargas marcadas',exact:true})).toContainText('GPS recibido');
  expect(await page.evaluate(()=>({calls:(window as any).qaWatchCalls,active:(window as any).qaWatchIds.size}))).toEqual({calls:2,active:1});
  await proof(page,info,'gps-retry-single-action');
  await page.getByRole('button',{name:'Quitar '+set.records.permission.numero+' del GPS',exact:true}).click();await expect(page.getByRole('region',{name:'Cargas marcadas',exact:true})).toHaveCount(0);await expect(page.getByText('Revisá las cargas marcadas: no se está enviando GPS.',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).qaWatchIds.size)).toBe(0);
  const token=await page.evaluate(()=>localStorage.getItem('sitrep_access_token'));const detail=await page.request.get('/api/manifiestos/'+set.records.permission.id,{headers:{Authorization:'Bearer '+token}});expect(detail.status()).toBe(200);expect((await detail.json()).data.manifiesto.estado).toBe('EN_TRANSITO');
  await proof(page,info,'gps-selection-cleared-without-delivery');expect(errors).toEqual([]);
  writeFileSync(info.outputPath('gps-denied-proof.json'),JSON.stringify({deniedBeforeAnyUpload:true,singleActionRetry:true,onlyOneWatcherAfterRetry:true,noWatcherAfterRemoval:true,afterRemovalStillInTransit:true,production:false}));
 }finally{await ctx.close();}
});
