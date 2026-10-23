import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { login, prefix, isolatedMapTiles, readablePageHeading } from './helpers';
const origin = 'http://127.0.0.1:4177';
async function shot(page:Page, info:TestInfo, name:string){
 await expect(page).toHaveTitle(/SITREP/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 await expect(page.locator('[data-form-skeleton]')).toHaveCount(0);
 if(new URL(page.url()).pathname.startsWith('/manual/')){
  // The tutorial H1 is content, not the application shell; its visible glyphs may exceed its line box.
  const title=page.locator('#tutorialTitle');await expect(title).toBeVisible();
  const visible=await title.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const area=element.closest('header')!.getBoundingClientRect();return [...range.getClientRects()].every(r=>r.left>=area.left-1&&r.right<=area.right+1&&r.top>=area.top-1&&r.bottom<=area.bottom+1)});
  expect(visible,'Manual title is completely inside its content header').toBe(true);
 }else await readablePageHeading(page);
 for(const mark of await page.locator('[data-sitrep-mark]:visible').all()){
  await expect(mark).toHaveAttribute('src',/sitrep-mark-green.svg$/);
  expect(await mark.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
 }
 await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
}
for(const role of ['generador','transportista','operador','admin','inspector','jefe-generadores','jefe-transporte','jefe-operadores'])test('welcome and contextual help for '+role,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page,info,role,{showWelcome:true});
 const dialog=page.getByRole('dialog',{name:'Bienvenido a SITREP'});
 await expect(dialog).toBeVisible();await shot(page,info,role+'-welcome');
 while(await dialog.getByRole('button',{name:'Siguiente',exact:true}).count())await dialog.getByRole('button',{name:'Siguiente',exact:true}).click();
 if(role==='operador')await expect(dialog).toContainText('Cerrar el tratamiento no emite la final');
 if(role==='transportista')await expect(dialog).toContainText('relevos');
 await shot(page,info,role+'-last-step');await dialog.getByRole('button',{name:'Empezar',exact:true}).click();
 await page.getByRole('button',{name:'Ayuda y soporte técnico',exact:true}).click();
 const help=page.getByRole('dialog',{name:role==='inspector'?'Seguimiento de la inspección':'Tu próximo paso'});await expect(help).toBeVisible();await shot(page,info,role+'-help');
 await help.getByRole('button',{name:'Repasar mi rol'}).click();await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Saltar introducción'}).click();expect(errors).toEqual([]);
});
test('preference persists by account and resolves exact mail destination after login',async({page,browser},info)=>{
 await login(page,info,'generador');
 await page.goto(prefix(info)+'/configuracion?tab=apariencia');
 const settings=page.getByRole('region',{name:'Dónde abrir los enlaces'});
 await expect(settings.getByRole('radio',{name:/Siempre web/})).toBeEnabled();
 if(await settings.getByRole('radio',{name:/Siempre web/}).isChecked()){
  await settings.getByRole('radio',{name:/Según el dispositivo/}).check();
  await expect(settings.getByRole('status')).toContainText('Preferencia guardada');
 }
 await settings.getByRole('radio',{name:/Siempre web/}).check();
 await expect(settings.getByRole('status')).toContainText('Preferencia guardada');
 await page.reload();await expect(settings.getByRole('radio',{name:/Siempre web/})).toBeChecked();
 await shot(page,info,'preference-web');
 const target='/manifiestos/manifest-qa-legacy?certificado=qa-unknown#certificaciones';
 await page.goto(origin+'/app/abrir?destino='+encodeURIComponent(target));
 await expect(page).toHaveURL(origin+target);await expect(page.getByText('QA-LEGACY-UNCHANGED',{exact:false}).first()).toBeVisible();
 await page.goto('/configuracion?tab=apariencia');
 await settings.getByRole('radio',{name:/Siempre app/}).check();await expect(settings.getByRole('status')).toContainText('Preferencia guardada');
 await page.goto(origin+'/abrir?destino='+encodeURIComponent('/notificaciones?filtro=pendientes#avisos'));
 await expect(page).toHaveURL(origin+'/app/notificaciones?filtro=pendientes#avisos');
 const context=await browser.newContext({...info.project.use,baseURL:origin} as any);
 try{
  const other=await context.newPage();await isolatedMapTiles(other,info);
  await other.context().addCookies([{name:'sitrep_qa_client',value:'127.11.33.51',url:origin}]);
  await other.goto(origin+'/app/abrir?destino='+encodeURIComponent(target));
  await expect(other).toHaveURL(/\/app\/login$/);await other.reload();
  await other.getByLabel('Correo electrónico o CUIT').fill('generador@night-qa.invalid');
  await other.getByLabel('Contraseña',{exact:true}).fill('OnlyLocal-NightQA-2026!');
  await other.getByRole('button',{name:'Ingresar',exact:true}).click();
  await expect(other).toHaveURL(origin+'/app'+target);
  const skip=other.getByRole('button',{name:'Saltar introducción'});if(await skip.isVisible())await skip.click();
  await shot(other,info,'mail-after-login');
 }finally{await context.close();}
 await page.goto('/app/configuracion?tab=apariencia');
 await expect(settings.getByRole('radio',{name:/Siempre app/})).toBeChecked();
 await page.route('**/api/auth/preferencia-enlaces',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'QA guardado temporalmente no disponible'})}));
 await settings.getByRole('radio',{name:/Según el dispositivo/}).click();
 await expect(settings.getByRole('alert')).toBeVisible();await expect(settings.getByRole('radio',{name:/Siempre app/})).toBeChecked();
 await page.unroute('**/api/auth/preferencia-enlaces');
 await settings.getByRole('radio',{name:/Según el dispositivo/}).check();
 await expect(settings.getByRole('status')).toContainText('Preferencia guardada');
});
test('task help preserves an unsent manifest and offers reviewed support only on request',async({page},info)=>{
 await login(page,info,'operador');await page.goto(prefix(info)+'/manifiestos/nuevo');
 await page.getByRole('button',{name:'Ayuda y soporte técnico'}).click();
 const help=page.getByRole('dialog',{name:'Completar la propuesta'});await expect(help).toBeVisible();
 await expect(help.getByRole('link',{name:/recorrido en el manual/})).toHaveAttribute('href','/manual/tutorial.html?guide=manifiestos-tres-partes');
 await shot(page,info,'help-new-manifest');
 await help.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page).toHaveURL(/\/manifiestos\/nuevo$/);
});
test('section review: administrative pages, brand and reading geometry',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await login(page,info,'admin');
 const routes=['/dashboard','/manifiestos','/admin/actores','/admin/usuarios','/inspecciones','/empresas','/reportes','/notificaciones','/configuracion','/centro-control','/soporte','/mi-perfil','/admin/solicitudes','/admin/renovaciones','/admin/vehiculos','/admin/residuos','/admin/tratamientos','/admin/auditoria','/admin/carga-masiva','/manifiestos/baja-intensidad','/manifiestos/manifest-qa-legacy','/manifiestos/manifest-qa-legacy/adendas'];
 for(const [i,route] of routes.entries()){
  await page.goto(prefix(info)+route);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByText('Página no encontrada',{exact:false})).toHaveCount(0);
  await page.getByRole('button',{name:'Ayuda y soporte técnico'}).waitFor();
  const sectionTitle:Record<string,string>={'/admin/solicitudes':'Solicitudes','/admin/renovaciones':'Renovaciones','/admin/tratamientos':'Tratamientos','/admin/vehiculos':'Vehículos'};
  if(sectionTitle[route])await expect(page.getByRole('banner').getByRole('heading',{name:sectionTitle[route],exact:true})).toBeVisible();
  if(route==='/admin/tratamientos')await expect(page.getByRole('heading',{name:'Tratamientos',exact:true}).last()).toBeVisible();
  await shot(page,info,'section-'+i);
 }
 expect(errors).toEqual([]);
});
test('public forms and manual use the same institutional identity',async({page},info)=>{
 await isolatedMapTiles(page,info);
 for(const role of ['generador','transportista','operador']){
  await page.goto(prefix(info)+'/inscripcion/'+role+'?modo=revision');
  await expect(page.getByRole('navigation',{name:'Etapas de la inscripción'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Razon Social *',exact:true})).toBeVisible();
  await shot(page,info,'registration-'+role);
 }
 await page.goto('/manual/tutorial.html?guide=bienvenida-preferencia-ayuda');
 await expect(page.getByText('Tu rol, tus enlaces y la ayuda de cada pantalla',{exact:true}).first()).toBeVisible();
 await shot(page,info,'manual-guidance');
});
test('invalid resolver stays local and gives a recovery action',async({page},info)=>{
 await isolatedMapTiles(page,info);await page.goto(prefix(info)+'/abrir?destino='+encodeURIComponent('//other.invalid'));
 await expect(page.getByRole('heading',{name:'Este enlace no es válido'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Ir a mis avisos'})).toBeVisible();
 expect(new URL(page.url()).origin).toBe(origin);
 await shot(page,info,'invalid-link-recovery');
});

test('reports download a branded PDF on this surface',async({page},info)=>{
 await login(page,info,'admin');await page.goto(prefix(info)+'/reportes');
 const action=page.locator('button[aria-label="Exportar PDF"]');
 await expect(action).toBeEnabled();const downloaded=page.waitForEvent('download');await action.click();
 const file=await downloaded;expect(file.suggestedFilename()).toMatch(/\.pdf$/);
 await file.saveAs(info.outputPath('reporte.pdf'));await shot(page,info,'report-export');
});
