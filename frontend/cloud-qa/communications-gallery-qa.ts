import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const root=process.cwd(),dir=path.join(process.env.QA_ARTIFACTS!,'gallery');
const req=createRequire(path.join(root,'frontend/package.json'));
const {chromium,expect}=req('@playwright/test');
const data=JSON.parse(fs.readFileSync(path.join(dir,'catalogue.json'),'utf8'));
function routes(file:string) {
 return [...fs.readFileSync(path.join(root,file),'utf8').matchAll(/<Route\s+path="([^"]+)"/g)]
  .map(match=>match[1]).filter(p=>p!=='*').map(p=>new RegExp('^'+p.split('/').map(segment=>segment.startsWith(':')?'[^/]+':segment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'/?$'));
}
const webRoutes=routes('frontend/src-v6/App.tsx'),appRoutes=routes('frontend/src-v6/AppMobile.tsx');

const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors:string[]=[],requests:string[]=[],checks:any[]=[],overflows:any[]=[];
page.on('pageerror',(e:any)=>errors.push(e.message));
page.on('console',(m:any)=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',(r:any)=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
await page.route('**/*',async(route:any)=>{if(/^https?:/.test(route.request().url()))return route.abort();return route.continue();});
async function check(name:string,fn:()=>Promise<void>){await fn();checks.push({name,passed:true});console.log('PASS '+name);}
async function preview(){
 const frame=page.locator('iframe');
 if(await frame.count()){
   await expect(frame).toBeVisible();
   await expect.poll(async()=>frame.evaluate((e:any)=>e.contentDocument?.body?.innerText?.trim().length||0)).toBeGreaterThan(10);
   await page.waitForFunction(()=>{const e=document.querySelector('iframe') as HTMLIFrameElement;return !!e?.contentDocument?.body&&e.offsetHeight>=220;});
 }
}
async function select(id:string,fast=false){const button=page.locator('.case[data-id="'+id+'"]');if(fast)await button.dispatchEvent('click');else await button.click();await preview();}
async function channel(name:string,fast=false){const button=page.locator('[data-channel="'+name+'"]');if(fast)await button.dispatchEvent('click');else await button.click();await preview();}
try{
 await page.goto('file://'+path.join(dir,'index.html'));
 await preview();
 await check('every email retains app and web destinations with identical record and parameters',async()=>{
   for(const [ref,html] of Object.entries(data.blobs) as [string,string][]){
     if(!html.includes('data-mail-action'))continue;
     const links=[...html.matchAll(/data-mail-action="(preferred|app|web)" href="([^"]+)"/g)];
     assert.ok(links.length>=3,ref);assert.equal(links.length%3,0,ref);
     for(let i=0;i<links.length;i+=3){
       const group=new Map(links.slice(i,i+3).map(link=>[link[1],new URL(link[2].replace(/&amp;/g,'&'))]));
       const app=group.get('app')!,web=group.get('web')!,preferred=group.get('preferred')!;
       assert.ok(app&&web&&preferred,ref);
       assert.equal(app.origin,'https://sitrep.example.invalid',ref);assert.equal(web.origin,app.origin,ref);
       assert.equal(preferred.origin,app.origin,ref);assert.equal(preferred.pathname,'/app/abrir',ref);
       assert.equal(preferred.searchParams.get('destino'),web.pathname+web.search+web.hash,ref);
       assert.equal(app.pathname,'/app'+web.pathname,ref);assert.equal(app.search+app.hash,web.search+web.hash,ref);
       assert.ok(!app.href.includes('undefined'),ref);
       assert.ok(webRoutes.some(route=>route.test(web.pathname)),ref+' missing web route '+web.pathname);
       assert.ok(appRoutes.some(route=>route.test(app.pathname.slice(4))),ref+' missing app route '+app.pathname);
     }
   }
 });
 await check('identity, meaningful content and no framework overlay',async()=>{
   await expect(page).toHaveTitle('SITREP · Galería de comunicaciones');
   await expect(page.locator('h1')).toContainText('Lo que recibe cada persona');
   await expect(page.locator('#stats')).toContainText(String(data.cases.length));
   assert.equal(await page.locator('vite-error-overlay,nextjs-portal').count(),0);
 });
 await page.screenshot({path:path.join(dir,'gallery-desktop.png'),fullPage:false});
 await check('search, empty result and clear',async()=>{
   await page.locator('#search').fill('zzzz-no-existe');
   await expect(page.locator('#result-count')).toHaveText('0 resultados');
   await expect(page.locator('.empty-list')).toBeVisible();
   await page.locator('#search').fill('');
   await expect(page.locator('#result-count')).toHaveText(data.cases.length+' resultados');
 });
 await check('all eight recipient filters and PSIP family',async()=>{
   for(const role of data.coverage.roles){await page.locator('#role').selectOption(role);assert.ok(await page.locator('.case').count()>0);await preview();}
   await page.locator('#role').selectOption('ADMIN');
   await page.locator('#family').selectOption('PSIP · intercambio');
   await select('psip-RESPUESTA');
   await expect(page.locator('#meta')).toContainText('Super Admin');
   await channel('inbox');
   const style=await page.locator('iframe').evaluate((e:any)=>{const doc=e.contentDocument;const title=doc.querySelector('ul[aria-label="Avisos"] li button span.block');return {font:e.contentWindow.getComputedStyle(doc.body).fontFamily,size:title?e.contentWindow.getComputedStyle(title).fontSize:'',title:title?.textContent||''};});
   assert.match(style.font,/Inter|sans-serif/);
   assert.ok(style.title.includes('Nueva respuesta'));
   assert.ok(parseFloat(style.size)>=14,'Notice title must remain readable');
   await page.screenshot({path:path.join(dir,'gallery-inbox-desktop.png'),fullPage:false});
 });
 await check('actual inbox read/unread renders',async()=>{
   const unread=await page.locator('iframe').evaluate((e:any)=>e.contentDocument.body.innerHTML);
   await page.locator('#read').check();await preview();
   const read=await page.locator('iframe').evaluate((e:any)=>e.contentDocument.body.innerHTML);
   assert.notEqual(read,unread);
   await page.locator('#read').uncheck();await preview();
 });
 await check('toast and simulated push are distinct',async()=>{
   await channel('toast');await expect(page.locator('#surface-label')).toContainText('componente real');
   await channel('push');await expect(page.locator('.push-title')).toBeVisible();
   await expect(page.locator('.push-foot')).toContainText('No acredita');
 });
 await page.locator('#role').selectOption('');await page.locator('#family').selectOption('');
 await check('three corrected mail meanings match their actual renders',async()=>{
   for(const [id,phrase] of [['adenda-APROBADA','aprobación individual'],['atm-repetido','no acredita un pago nuevo'],['estado-TRATADO','no confirma que se haya emitido una certificación']]){
     const c=data.cases.find((entry:any)=>entry.id===id||entry.id.startsWith(id+'-'));
     assert.ok(c,'missing '+id);await select(c.id);await channel('email');
     await expect(page.locator('iframe').contentFrame().locator('body')).toContainText(phrase);
     await expect(page.locator('#review')).toContainText('Corregido:');
   }
 });
 await check('current delivery and operational producers include their scoped representative notices',async()=>{
   for(const [id,role] of [
     ['entrega-representante-GENERADOR','GENERADOR'],['entrega-representante-TRANSPORTISTA','TRANSPORTISTA'],
     ['entrega-representante-OPERADOR','OPERADOR'],['operacion-representante-INCIDENTE','OPERADOR'],
     ['operacion-representante-INCIDENTE-SIN-DESCRIPCION','OPERADOR'],
     ['operacion-representante-RECHAZO','GENERADOR'],['operacion-representante-DIFERENCIA_PESO','GENERADOR'],
     ['transito-representante-GENERADOR','GENERADOR'],['transito-representante-TRANSPORTISTA','TRANSPORTISTA'],
     ['transito-representante-OPERADOR','OPERADOR'],['regla-representante-GENERADOR','GENERADOR'],
     ['regla-representante-TRANSPORTISTA','TRANSPORTISTA'],['regla-representante-OPERADOR','OPERADOR'],
   ]){
     const item=data.cases.find((entry:any)=>entry.id===id);
     assert.ok(item,'missing '+id);
     const metadata=JSON.parse(item.notice.datos);
     assert.equal(metadata.destino,'representante',id);assert.equal(metadata.accesosEmpresa[0].rol,role,id);
     assert.equal(item.paths[role],'/notificaciones/'+item.notice.id,id);
     const mail=item.mailRefs[role];assert.ok(mail,id+' missing mail render');
     const html=data.blobs[mail.ref];
     const web=html.match(/data-mail-action="web" href="([^"]+)"/);
     assert.ok(web,id+' missing web action');
     assert.equal(new URL(web[1].replace(/&amp;/g,'&')).pathname,'/notificaciones/'+item.notice.id,id);
   }
   for(const name of ['manifestDeliveryNotice.service.ts','manifestOperationalNotice.service.ts'])
     assert.ok(data.coverage.discoveredProducers.some((file:string)=>file.endsWith(name))&&data.cases.some((item:any)=>item.source.endsWith(name)),name);
   await page.locator('#role').selectOption('GENERADOR');await page.locator('#family').selectOption('Manifiestos · operación');
   await select('entrega-representante-GENERADOR');await channel('inbox');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('Entrega confirmada');
   await channel('email');await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('entrega fue registrada');
   await page.locator('#role').selectOption('');await page.locator('#family').selectOption('');
 });
 await check('origin certificates include the approving carrier when one is linked',async()=>{
   for(const kind of ['PARCIAL','FINAL']){
     const current=data.cases.find((entry:any)=>entry.id==='certificado-insitu-'+kind);
     const historical=data.cases.find((entry:any)=>entry.id==='certificado-insitu-historico-'+kind);
     assert.ok(current&&historical,'missing origin certificate '+kind);
     assert.deepEqual([...current.roles].sort(),['GENERADOR','TRANSPORTISTA']);
     assert.deepEqual(historical.roles,['GENERADOR']);
     assert.match(current.note,/transporte aprobador también recibe/i);
   }
   await page.locator('#role').selectOption('TRANSPORTISTA');await page.locator('#family').selectOption('Certificados');
   await select('certificado-insitu-FINAL');await channel('email');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('Certificación final total disponible');
   await page.locator('#role').selectOption('');await page.locator('#family').selectOption('');
 });
 await check('default GPS notices use the current transactional producer',async()=>{
   for(const [id,title] of [['gps-ALTA','GPS: posible velocidad elevada'],['gps-NORMAL','GPS: posible parada'],
     ['gps-sin-recepcion','GPS: sin posiciones recibidas']]){
     const item=data.cases.find((entry:any)=>entry.id===id);
     assert.ok(item,id);assert.equal(item.notice.titulo,title,id);
     assert.ok(item.source.endsWith('/defaultAdminNotice.service.ts'),id);
     assert.match(item.notice.mensaje,/Hora de captura no disponible/);
   }
   assert.ok(data.coverage.discoveredProducers.some((file:string)=>file.endsWith('/defaultAdminNotice.service.ts')));
 });
 await check('origin notices and email do not describe a pickup',async()=>{
   await select('propuesta-insitu-iniciada');await channel('email');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('No hay retiro, viaje ni GPS');
   await channel('inbox');await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('No hay retiro, viaje ni GPS');
   await select('estado-insitu-TRANSPORTISTA');await channel('inbox');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('No hay retiro, traslado ni GPS');
   await select('propuesta-insitu-historica-iniciada');await channel('email');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('siguiente acción');
   await expect(page.locator('iframe').contentFrame().locator('body')).not.toContainText('preparar el retiro');
   await select('propuesta-insitu-historica-aprobada');await channel('email');
   await expect(page.locator('iframe').contentFrame().locator('body')).not.toContainText('aprobado por las tres partes');
 });
 await check('GPS observations and configured duration show their actual limits',async()=>{
   for(const id of ['gps-ALTA','gps-NORMAL','gps-sin-recepcion']){
     await select(id);await channel('inbox');
     await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('Hora de captura no disponible');
     await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('Verificá el caso con transporte');
     await channel('email');
     await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('hora de captura puede ser anterior a la recepción');
   }
   await select('transito-tiempo');await channel('inbox');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('umbral configurado por Ambiente');
   await expect(page.locator('iframe').contentFrame().locator('body')).not.toContainText('Tiempo de Tránsito Excesivo');
   await channel('email');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('umbral de duración configurado por Ambiente');
   await expect(page.locator('iframe').contentFrame().locator('body')).toContainText('no implica un plazo obligatorio');
 });
 await page.locator('[data-width="mobile"]').click();
 await check('all scenarios, email and inbox, at phone preview width',async()=>{
   for(const [index,c] of data.cases.entries()){
     if(index%30===0)console.log('Rendered '+index+'/'+data.cases.length+' scenarios');
     await select(c.id,true);
     for(const ch of ['email','inbox']){
       await channel(ch,true);
       const iframe=page.locator('iframe');
       if(await iframe.count()){
         const size=await iframe.evaluate((e:any)=>({width:e.contentDocument.documentElement.clientWidth,scroll:e.contentDocument.documentElement.scrollWidth,text:e.contentDocument.body.innerText.length,images:[...e.contentDocument.images].filter((i:any)=>!i.complete||i.naturalWidth===0).length}));
         assert.ok(size.text>10,c.id+' blank '+ch);
         assert.equal(size.images,0,c.id+' missing image '+ch);
         if(ch==='email') {
          const brand=await iframe.evaluate((e:any)=>{const mark=e.contentDocument.querySelector('[data-mail-wordmark]');return mark?{text:mark.textContent,color:e.contentWindow.getComputedStyle(mark).color}:null;});
          assert.deepEqual(brand,{text:'SITREP',color:'rgb(27, 94, 60)'},c.id+' email wordmark');
         }
         if(size.scroll>size.width+2)overflows.push({id:c.id,channel:ch,...size});
       } else await expect(page.locator('.unavailable')).toBeVisible();
     }
   }
 });
 await page.setViewportSize({width:390,height:844});
 await select('certificado-PARCIAL');await channel('email');
 await check('phone gallery has no horizontal overflow',async()=>{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 });
 await page.screenshot({path:path.join(dir,'gallery-mobile-top.png'),fullPage:false});
 await page.locator('#selection-title').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(dir,'gallery-mobile-email.png'),fullPage:false});
 await channel('inbox');await page.locator('#selection-title').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(dir,'gallery-mobile-inbox.png'),fullPage:false});
 await check('no runtime errors or external network requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.deepEqual(overflows,[]);});
 console.log(JSON.stringify({checks:checks.length,overflows}));
}finally{
 fs.writeFileSync(path.join(dir,'qa-result.json'),JSON.stringify({browserPath:'Playwright en QA remoto aislado; navegación del producto comprobada por separado en IAB',viewports:[{width:1440,height:1000},{width:390,height:844}],sampleWidth:375,source:data.coverage.source,checks,overflows,errors,externalRequests:requests},null,2));
 await browser.close();
}
