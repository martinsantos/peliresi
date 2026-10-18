import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {chromium,expect,type Page} from '@playwright/test';
import {trainingCredentials} from './apk-training-policy.ts';
import {origin,cap5Allowed,manifests,fields} from './cap5-policy.ts';

assert.equal(process.env.GITHUB_REPOSITORY,'martinsantos/peliresi');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.QA_CAP5_AUTHORIZED,'true');
const account=trainingCredentials(process.env.QA_APK_CREDENTIALS);delete process.env.QA_APK_CREDENTIALS;
console.log('::add-mask::'+account.password);
const out='/tmp/sitrep-cap5';mkdirSync(out,{recursive:true});
const results:any[]=[],writes:any[]=[],blocked:any[]=[],errors:any[]=[],warnings:any[]=[];
const browser=await chromium.launch();
let page:Page;
const writeResult=()=>writeFileSync(path.join(out,'result.json'),JSON.stringify({at:new Date().toISOString(),run:process.env.GITHUB_RUN_ID,results,writes,blocked,errors,warnings,mail:false,newTickets:false,scope:'Published web/app, CAP 5 only. Browser plugin not available. No local browser.'},null,2));
try{
 for(const [surface,width,prefix,index]of [['web',1440,'',0],['app',360,'/app',1]] as const){
  const context=await browser.newContext({viewport:{width,height:900},locale:'es-AR',serviceWorkers:'block'});
  await context.route(origin+'/api/**',async route=>{
   const request=route.request(),pathname=new URL(request.url()).pathname;
   if(!cap5Allowed(request.url(),request.method(),request.postData(),request.headers().authorization,account.id)){
    blocked.push({surface,method:request.method(),path:pathname});return route.abort('blockedbyclient');
   }
   if(!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push({surface,method:request.method(),path:pathname});
   return route.continue();
  });
  page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push({surface,message:e.message}));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push({surface,type:m.type(),message:m.text().slice(0,500)});});
  const goto=async(p:string)=>{await page.goto(origin+prefix+p);await expect(page).toHaveTitle(/SITREP/i);await expect(page.locator('vite-error-overlay')).toHaveCount(0);};
  const proof=async(name:string)=>{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,'Page horizontal overflow');
   await page.screenshot({path:path.join(out,surface+'-'+name+'.png'),animations:'disabled'});
  };
  const step=async(name:string,fn:()=>Promise<void>)=>{
   console.log('START '+surface+' '+name);
   try{await fn();results.push({surface,name,passed:true});console.log('PASS '+surface+' '+name);}
   catch(e){results.push({surface,name,passed:false,error:String(e).replaceAll(account.password,'[REDACTED]')});await page.screenshot({path:path.join(out,surface+'-'+name+'-FAIL.png')}).catch(()=>{});writeFileSync(path.join(out,surface+'-'+name+'-FAIL.txt'),await page.locator('body').innerText().catch(()=>''));console.log('FAIL '+surface+' '+name);}
   writeResult();
  };
  const postClick=async(suffix:string,click:()=>Promise<unknown>,method='POST')=>{
   const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(suffix)&&r.request().method()===method),click()]);
   assert.equal(response.status(),method==='POST'&&suffix.endsWith('/intercambios')?201:200,suffix+' '+await response.text());
   if(!suffix.startsWith('/api/auth')&&!suffix.includes('/training/impersonate'))assert.equal(response.headers()['x-sitrep-training'],'true');
   return response;
  };
  const dismiss=async()=>{const intro=page.getByRole('button',{name:'Saltar introducción',exact:true});if(await intro.isVisible())await intro.click();};
  // Use the full observed endpoint; keep selection by name instead of row order.
  const asRole=async(category:string)=>{
   const back=page.getByRole('button',{name:'Volver a mi cuenta',exact:true});if(await back.isVisible()){await back.click();await expect(page).toHaveURL(/\/switch-user$/);}
   await goto('/switch-user');await dismiss();await page.getByRole('button',{name:'Capacitación',exact:true}).click();
   const group=page.getByRole('region',{name:category,exact:true});
   await expect(group.getByRole('button',{name:/^Ver como CAP/})).toHaveCount(5);
   const role=({Generadores:'generador',Transportistas:'transportista',Operadores:'operador',Inspectores:'inspector',Administradores:'admin'} as any)[category];
   await postClick('/api/admin/training/impersonate/cap-20261012-'+role+'-5',()=>group.getByRole('button',{name:new RegExp('^Ver como CAP · '+role.toUpperCase()+' 5(?:\\s|$)')}).click());
   await expect(page.getByText('Capacitación · sin validez oficial',{exact:false}).first()).toBeVisible();await dismiss();
  };
  await step('trial-ocr-draft',async()=>{
   for(const [type,total,second]of [['generador',7,'Regulatorio'],['operador',8,'Regulatorio'],['transportista',5,'Habilitacion']] as const){
    await goto('/inscripcion/'+type+'?modo=revision');
    await page.getByLabel('Razon Social *',{exact:true}).fill('CAP 5 ensayo '+surface+' '+type);
    await page.getByRole('button',{name:`Paso 2 de ${total}: ${second}`,exact:true}).click();
    await page.getByRole('button',{name:'Guardar borrador de prueba',exact:true}).click();await page.reload();
    await expect(page.getByRole('navigation',{name:'Etapas de la inscripción'}).locator('[aria-current=step]')).toHaveAttribute('aria-label',`Paso 2 de ${total}: ${second}`);
    await page.getByRole('button',{name:new RegExp('^Paso 1 de '+total+':')}).click();await expect(page.getByLabel('Razon Social *',{exact:true})).toHaveValue('CAP 5 ensayo '+surface+' '+type);
   }
   await page.getByRole('button',{name:/^Paso 3 de 5:/}).click();await page.getByRole('button',{name:'Agregar chofer',exact:true}).click();
   const driver=page.getByRole('group',{name:'Chofer 2',exact:true});
   const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/solicitudes/analizar-documento')&&r.request().method()==='POST'),driver.getByLabel('Archivo de licencia del chofer 2').setInputFiles({name:'LICENCIA-CAP-SIN-VALIDEZ.png',mimeType:'image/png',buffer:readFileSync(new URL('../../docs/manual/fixtures/licencia-capacitacion.png',import.meta.url))})]);
   assert.equal(response.status(),200);const data=(await response.json()).data;assert.equal(data.persistido,false);assert.equal(data.analisis.lectura,'LEIDO');
   await driver.getByRole('button',{name:'Usar datos seleccionados',exact:true}).click();await expect(driver.getByLabel('DNI *',{exact:true})).toHaveValue(data.campos.dni);
   await page.getByRole('button',{name:'Guardar borrador de prueba',exact:true}).click();await page.reload();await driver.scrollIntoViewIfNeeded();await expect(driver.getByLabel('DNI *',{exact:true})).toHaveValue(data.campos.dni);await proof('ocr-recovered');
  });
  await step('login-selector',async()=>{
   await goto('/switch-user');await page.getByLabel('Correo electrónico o CUIT').fill(account.email);await page.getByLabel('Contraseña',{exact:true}).fill(account.password);
   const response=await postClick('/api/auth/login',()=>page.getByRole('button',{name:'Ingresar',exact:true}).click());assert.equal((await response.json()).data.user.id,account.id);
   await expect(page).not.toHaveURL(/\/login$/);await dismiss();await asRole('Generadores');await proof('cap5-identity');
  });
  await step('manifest-complete',async()=>{
   const id=manifests[index];await asRole('Generadores');await goto('/manifiestos/'+id);
   await page.getByRole('button',{name:'Firmar Manifiesto',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Firma del manifiesto',exact:true});const canvas=dialog.locator('canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
   await page.mouse.move(b.x+b.width*.1,b.y+b.height*.6);await page.mouse.down();for(const[x,y]of [[.2,.2],[.4,.6],[.6,.3],[.8,.7]])await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});await page.mouse.up();
   await dialog.getByRole('button',{name:'Usar firma',exact:true}).click();await postClick('/'+id+'/firmar',()=>dialog.getByRole('button',{name:'Confirmar y Firmar',exact:true}).click());await proof('manifest-signed');
   await asRole('Transportistas');await goto('/manifiestos/'+id);await postClick('/'+id+'/confirmar-retiro',()=>page.getByRole('button',{name:'Confirmar retiro',exact:true}).click());
   await page.getByRole('button',{name:'Confirmar entrega',exact:true}).click();await postClick('/'+id+'/confirmar-entrega',()=>page.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click());
   await asRole('Operadores');await goto('/manifiestos/'+id);await postClick('/'+id+'/confirmar-recepcion',()=>page.getByRole('button',{name:'Confirmar Recepcion',exact:true}).click());
   await page.getByRole('button',{name:'Registrar Tratamiento',exact:true}).click();const treatment=page.getByRole('dialog',{name:'Registrar Tratamiento',exact:true});await treatment.getByPlaceholder('Observaciones del tratamiento...').fill('CAP 5 · Ensayo '+surface+' sin validez oficial');
   await postClick('/'+id+'/tratamiento',()=>treatment.getByRole('button',{name:'Confirmar Tratamiento',exact:true}).click());await postClick('/'+id+'/cerrar',()=>page.getByRole('button',{name:'Cerrar Manifiesto',exact:true}).click());await page.reload();
   await expect(page.getByRole('button',{name:'Descargar Certificado',exact:true})).toBeDisabled();await expect(page.getByText('Capacitación: no se emiten documentos oficiales.')).toBeVisible();await proof('manifest-closed');
  });
  await step('inspection-field',async()=>{
   await asRole('Inspectores');const id=fields[index];await goto('/inspecciones/'+id);const nav=page.getByRole('navigation',{name:'Secciones del expediente'});
   await nav.getByRole('link',{name:'Visita',exact:true}).click();await postClick('/inspecciones/'+id+'/estado',()=>page.getByRole('button',{name:'Iniciar visita',exact:true}).click());
   await nav.getByRole('link',{name:'Controles',exact:true}).click();const control=page.locator('[id^="control-"]').first();const toggle=control.locator('button[aria-expanded]').first();if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await control.getByRole('button',{name:'Cumple',exact:true}).click();
   await postClick('/inspecciones/'+id,()=>page.getByTestId('inspection-field-save-bar').getByRole('button',{name:'Guardar cambios',exact:true}).click(),'PATCH');await page.reload();await nav.getByRole('link',{name:'Controles',exact:true}).click();if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await expect(control.getByRole('button',{name:'Cumple',exact:true})).toHaveAttribute('aria-pressed','true');await proof('inspection-saved');
  });
  for(const[category,role]of [['Generadores','GENERADOR'],['Transportistas','TRANSPORTISTA'],['Operadores','OPERADOR']])await step('exchange-'+role,async()=>{
   await asRole(category);const id='cap-20261012-participacion-5-'+role+'-abierta';await goto('/mis-inspecciones');await page.getByRole('button',{name:new RegExp('CAP-P-5-'+role+'-A')}).click();await expect(page.getByText('Vista: Inspeccionado',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Responder esta actuación',exact:true}).last().click();const text='CAP 5 · Ensayo '+surface+' '+role+' '+process.env.GITHUB_RUN_ID;await page.getByLabel('Contenido',{exact:true}).fill(text);await postClick('/'+id+'/intercambios',()=>page.getByRole('button',{name:'Presentar en expediente',exact:true}).click());await page.reload();await expect(page.getByText(text,{exact:true})).toBeVisible();await proof(role+'-response');
   // Preserve the request for the app repetition; close after its second reply.
   if(index===1){await asRole('Administradores');await goto('/inspecciones/'+id);await page.getByRole('navigation',{name:'Secciones del expediente'}).getByRole('link',{name:'Expediente',exact:true}).click();await page.getByRole('navigation',{name:'Apartados de Expediente'}).getByRole('link',{name:'Comunicaciones',exact:true}).click();await page.getByRole('button',{name:'Cerrar conforme',exact:true}).click();await page.getByLabel('Fundamento de la decisión').fill('CAP 5 · Ensayo web y app revisado, sin actuación real.');await postClick('/intercambios/decision',()=>page.getByRole('button',{name:'Confirmar cierre conforme',exact:true}).click());await asRole(category);await goto('/mis-inspecciones/'+id);await expect(page.getByRole('button',{name:'Responder esta actuación',exact:true})).toHaveCount(0);await expect(page.getByText('CAP 5 · Ensayo web y app revisado, sin actuación real.',{exact:true})).toBeVisible();await proof(role+'-closed');}
  });
  await step('support-handoff',async()=>{
   const actor=index===0?'generador':'transportista',category=index===0?'Generadores':'Transportistas',id='cap-20261012-ticket-'+actor+'-5';
   await asRole('Administradores');await goto('/soporte/'+id);const attention=page.getByRole('region',{name:'Atender ticket',exact:true});
   const send=async(action:string,body:string,submit:string)=>{await attention.getByRole('button',{name:action,exact:true}).click();await attention.getByRole('textbox',{name:/Mensaje o resolución|Nota interna \/ motivo/}).fill(body);await postClick('/'+id+'/acciones',()=>attention.getByRole('button',{name:submit,exact:true}).click());};
   const note='CAP 5 · Nota interna '+surface+' '+process.env.GITHUB_RUN_ID,reply='CAP 5 · Respuesta al autor '+surface+' '+process.env.GITHUB_RUN_ID;
   await send('Nota interna',note,'Guardar nota interna');await attention.getByRole('button',{name:'Derivar',exact:true}).click();await attention.getByRole('button',{name:'Nuevo responsable',exact:true}).click();await page.getByRole('option',{name:/^CAP · INSPECTOR 5 ·/}).click();await postClick('/'+id+'/acciones',()=>attention.getByRole('button',{name:'Confirmar derivación',exact:true}).click());
   await asRole('Inspectores');await goto('/soporte/'+id);await expect(page.getByText(note,{exact:true})).toBeVisible();await send('Responder',reply,'Enviar respuesta');await asRole(category);await goto('/soporte/'+id);await expect(page.getByText(reply,{exact:true})).toBeVisible();await expect(page.getByText(note,{exact:true})).toHaveCount(0);await send('Cerrar','CAP 5 · Confirmada la respuesta '+surface,'Cerrar con resolución');await page.reload();await expect(page.getByText('Cerrado',{exact:true}).first()).toBeVisible();await proof('ticket-closed');
  });
  await step('maps-and-manual',async()=>{
   await asRole('Administradores');const activity=page.waitForResponse(r=>r.url().includes('/api/centro-control/actividad'));await goto('/centro-control');assert.equal((await activity).status(),200);await expect(page.getByRole('group',{name:'Capas del mapa',exact:true})).toBeVisible();await proof('control');
   const live=page.waitForResponse(r=>r.url().includes('/api/centro-control/monitor-live'));await goto('/monitor');assert.equal((await live).status(),200);await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByRole('button',{name:'Período de reproducción'}).click();const timeline=page.waitForResponse(r=>r.url().includes('/api/centro-control/timeline')&&new URL(r.url()).searchParams.get('dias')==='30');await page.getByRole('option',{name:'Últimos 30 días',exact:true}).click();assert.equal((await timeline).status(),200);await expect(page.getByRole('button',{name:'Reproducir historial',exact:true})).toBeVisible();await proof('monitor-30-days');
   await page.goto(origin+'/manual/tutorial.html?guide=capacitacion-por-rol');await expect(page.getByText('Equipo 5',{exact:true}).first()).toBeVisible();await proof('manual');
  });
  await context.close();
 }
}finally{await browser.close();writeResult();}
assert.ok(results.length===18&&results.every(r=>r.passed),'CAP 5 rehearsal has failures');
assert.deepEqual(errors,[],'Uncaught browser errors');
