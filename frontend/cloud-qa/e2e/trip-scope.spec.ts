import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase} from '../safety';
import {login,prefix} from './helpers';

test.beforeAll(async()=>{await assertCloudDatabase();});
async function chooseCompany(page:Page,mp:string,company:{id:string;name:string}){
 await page.goto(`${mp}/empresas`);
 const companySelect=page.getByLabel('Empresa',{exact:true});
 await expect(companySelect.locator(`option[value="${company.id}"]`)).toHaveCount(1);
 await companySelect.selectOption(company.id);
 const chooser=page.getByLabel('Cambiar contexto de trabajo');
 await expect(chooser).toBeVisible();
 await chooser.locator('summary').click();
 await chooser.getByRole('button',{name:'Usar esta actividad',exact:true}).click();
 await expect(page.getByText(new RegExp('Actuando por '+company.name))).toBeVisible();
}

test('a saved trip from one company is not shown after switching to another company',async({browser},info)=>{
 const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'trip-scope-private.json'),'utf8'));
 const manifest=fixture.cases[info.project.name],mp=prefix(info),[first,second]=fixture.companies;
 const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
  isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
 const page=await context.newPage(),errors:string[]=[];let releaseDenial=()=>{};page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{(window as any).__qaGpsWatches=0;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(){(window as any).__qaGpsWatches++;return 1;},getCurrentPosition(){},clearWatch(){}}});});
 try{
  await login(page,info,'draft-multirole-20261024');
  if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
  await chooseCompany(page,mp,first);
  const allowed=page.waitForResponse(response=>response.request().method()==='GET'&&response.url().endsWith(`/api/manifiestos/${manifest.id}`));
  await page.goto(`${mp}/transporte/viaje/${manifest.id}`);expect((await allowed).status()).toBe(200);
  await expect.poll(()=>page.evaluate(id=>Object.keys(localStorage).some(key=>key.startsWith('viaje_snapshot_')&&JSON.parse(localStorage.getItem(key)||'{}').id===id),manifest.id)).toBe(true);
  // A pause saved before the scoped format must never turn the GPS back on.
  await page.evaluate(id=>localStorage.setItem(`viaje_status_${id}`,'PAUSADO'),manifest.id);
  await page.reload();
  await expect(page.getByText('Viaje pausado',{exact:true})).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>(window as any).__qaGpsWatches),'Un viaje pausado no debe reactivar el GPS').toBe(0);
  await chooseCompany(page,mp,second);
  // A copy from an older version has no owner and must not become visible.
  await page.evaluate(({id,numero})=>localStorage.setItem(`viaje_snapshot_${id}`,JSON.stringify({id,numero,estado:'EN_TRANSITO'})),manifest);
  const denied=page.waitForResponse(response=>response.request().method()==='GET'&&response.url().endsWith(`/api/manifiestos/${manifest.id}`));
  await page.goto(`${mp}/transporte/viaje/${manifest.id}`);const status=(await denied).status();expect([403,404]).toContain(status);
  await expect(page.getByRole('heading',{name:'Viaje no disponible',exact:true})).toBeVisible({timeout:30_000});
  const shown=await page.getByText(manifest.numero,{exact:true}).count();
  await page.screenshot({path:info.outputPath('cambio-empresa.png'),animations:'disabled'});
  expect(shown,'Una empresa distinta no debe ver la copia local del viaje').toBe(0);
  // The original authorized context can still read its own copy on a network failure.
  await chooseCompany(page,mp,first);
  const route=`**/api/manifiestos/${manifest.id}`;
  await page.route(route,handler=>handler.abort('failed'));
  await page.goto(`${mp}/transporte/viaje/${manifest.id}`);
  await expect(page.getByText('Último estado guardado.',{exact:true})).toBeVisible({timeout:30_000});
  await expect(page.getByText(manifest.numero,{exact:true})).toBeVisible();
  // An older scoped copy with no verified handoff state is not evidence that
  // the original transporter still has custody. Do not start GPS or deliver.
  const savedHandoff=await page.evaluate(id=>{
    const key=Object.keys(localStorage).find(k=>k.startsWith('viaje_snapshot_v2_')&&JSON.parse(localStorage.getItem(k)||'{}').id===id);
    if(!key)throw new Error('Falta la copia del viaje de prueba');
    const value=JSON.parse(localStorage.getItem(key)!);const handoff=value.handoffActive;
    delete value.handoffActive;localStorage.setItem(key,JSON.stringify(value));return {key,handoff};
  },manifest.id);
  await page.reload();
  await expect(page.getByText(/Comprobando si hay un relevo/)).toBeVisible({timeout:30_000});
  await expect(page.getByRole('button',{name:'Confirmar entrega',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>(window as any).__qaGpsWatches),'Un relevo desconocido no debe iniciar el GPS').toBe(0);
  await page.evaluate(({key,handoff})=>{const value=JSON.parse(localStorage.getItem(key)!);value.handoffActive=handoff;localStorage.setItem(key,JSON.stringify(value));},savedHandoff);
  await page.unroute(route);
  // Even a matching old copy cannot override an explicit denial in the current context.
  let requested=0;const gate=new Promise<void>(resolve=>{releaseDenial=resolve;});
  await page.route(route,async handler=>{requested++;await gate;await handler.fulfill({status:403,contentType:'application/json',body:JSON.stringify({success:false,message:'Acceso no disponible'})});});
  await page.reload({waitUntil:'domcontentloaded'});
  await expect.poll(()=>requested).toBeGreaterThan(0);
  expect(await page.getByText(manifest.numero,{exact:true}).count(),'No mostrar la copia mientras se valida el acceso en línea').toBe(0);
  releaseDenial();
  await expect(page.getByRole('heading',{name:'Viaje no disponible',exact:true})).toBeVisible({timeout:30_000});
  expect(await page.getByText(manifest.numero,{exact:true}).count()).toBe(0);
  expect(requested,'Una denegación explícita no debe reintentarse automáticamente').toBe(1);
  writeFileSync(info.outputPath('trip-scope-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,deniedStatus:status,staleTripShown:false,ownOfflineCopy:true,unknownHandoffBlocked:true,explicitDenialHidden:true,legacyPausePreserved:true}));
  expect(errors).toEqual([]);
 }finally{releaseDenial();await context.close();}
});
