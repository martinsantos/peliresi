import { test,expect,type Page } from '@playwright/test';
import { readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login,prefix } from './helpers';

test.beforeAll(async()=>{await assertCloudDatabase();});
async function mockGps(page:Page) {
  await page.addInitScript(()=>{
    let watcher:PositionCallback|undefined;
    (window as any).__scopeGps={ready:()=>!!watcher,emit:()=>watcher?.({coords:{latitude:-33.62,longitude:-68.62,
      accuracy:10,speed:null,heading:null,altitude:null,altitudeAccuracy:null},timestamp:Date.now()} as GeolocationPosition)};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(callback:PositionCallback){watcher=callback;return 1;},
      getCurrentPosition(){},clearWatch(){watcher=undefined;}}});
  });
}
async function companyPicker(page:Page,mp:string,company:{id:string;name:string},personal=false) {
  await page.goto(`${mp}/empresas`);
  const selector=page.getByLabel('Empresa',{exact:true});
  if(await selector.count()) {await expect(selector.locator(`option[value="${company.id}"]`)).toHaveCount(1);await selector.selectOption(company.id);}
  const chooser=page.getByLabel('Cambiar contexto de trabajo');await expect(chooser).toBeVisible();
  await chooser.locator('summary').click();
  await chooser.getByRole('button',{name:personal?'Volver a mi cuenta personal':'Usar esta actividad',exact:true}).click();
  if(!personal) await expect(page.getByText(new RegExp('Actuando por '+company.name))).toBeVisible();
  else await expect(page).toHaveURL(/dashboard/);
}

test('a saved point stays in its original authorized activity and blocks another activity from delivering',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'individual-gps-scope-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name].scope,mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const page=await context.newPage(),errors:string[]=[];let gpsAttempts=0,deliveries=0,allow=false;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`))deliveries++;});
  await mockGps(page);
  await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`,async route=>{gpsAttempts++;if(allow)await route.continue();else await route.abort('failed');});
  try {
    await login(page,info,'transportista');if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
    await page.goto(`${mp}/transporte/viaje/${manifest.id}`);
    await expect.poll(()=>page.evaluate(()=>(window as any).__scopeGps.ready())).toBe(true);
    await page.evaluate(()=>(window as any).__scopeGps.emit());
    await expect(page.getByText('-33.62000, -68.62000',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Ver todos mis viajes',exact:true}).click();
    const savedKey=await expect.poll(()=>page.evaluate(({owner,id})=>Object.keys(localStorage).filter(key=>{
      if(!key.startsWith('sitrep_gps_v3_'))return false;
      try {const value=JSON.parse(decodeURIComponent(key.slice('sitrep_gps_v3_'.length)));return value[0]===owner&&value[1]===id;}
      catch{return false;}
    }),{owner:String(fixture.owner),id:manifest.id})).toHaveLength(1).then(()=>page.evaluate(({owner,id})=>Object.keys(localStorage).find(key=>{
      if(!key.startsWith('sitrep_gps_v3_'))return false;try{const value=JSON.parse(decodeURIComponent(key.slice('sitrep_gps_v3_'.length)));return value[0]===owner&&value[1]===id;}catch{return false;}
    })!,{owner:String(fixture.owner),id:manifest.id}));
    const pending=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),savedKey);
    expect(pending).toHaveLength(1);expect(pending[0]).toMatchObject({lat:-33.62,lng:-68.62,puntoId:expect.any(String)});

    await companyPicker(page,mp,fixture.company);
    const loaded=page.waitForResponse(response=>response.request().method()==='GET'&&response.url().endsWith(`/api/manifiestos/${manifest.id}`));
    await page.goto(`${mp}/transporte/viaje/${manifest.id}`);expect((await loaded).status()).toBe(200);
    await expect.poll(()=>page.evaluate(()=>(window as any).__scopeGps.ready())).toBe(true);
    await page.waitForTimeout(1000);expect(gpsAttempts).toBe(0);
    expect(await page.evaluate(key=>localStorage.getItem(key),savedKey)).not.toBeNull();
    await page.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Confirmar Entrega?',exact:true});
    await dialog.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('otra actividad');
    expect(deliveries).toBe(0);expect(gpsAttempts).toBe(0);
    await page.screenshot({path:info.outputPath('otra-actividad-bloqueada.png'),animations:'disabled'});

    await companyPicker(page,mp,fixture.company,true);allow=true;
    const uploaded=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith(`/api/manifiestos/${manifest.id}/ubicacion-idempotente`),{timeout:60000});
    await page.goto(`${mp}/transporte/viaje/${manifest.id}`);
    const response=await uploaded;expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().puntoId).toBe(pending[0].puntoId);
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),savedKey)).toBeNull();
    expect(gpsAttempts).toBe(1);expect(deliveries).toBe(0);expect(errors).toEqual([]);
    writeFileSync(info.outputPath('scope-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,otherActivityBlocked:true,originalRecovered:true,gpsAttempts,deliveries}));
  } finally {await context.close();}
});

test('an account-only legacy queue is retained and explained without starting GPS',async({page},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'individual-gps-scope-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name].legacy,mp=prefix(info);let attempts=0;
  await mockGps(page);await page.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`,async route=>{attempts++;await route.abort('failed');});
  await login(page,info,'transportista');if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
  const oldKey=`sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner),manifest.id]))}`;
  const saved=JSON.stringify([{lat:-33.62,lng:-68.62,speed:null,heading:null}]);
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:oldKey,raw:saved});
  await page.goto(`${mp}/transporte/viaje/${manifest.id}`);
  await expect(page.getByRole('alert').filter({hasText:'sin actividad identificada'})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__scopeGps.ready())).toBe(false);
  expect(await page.evaluate(key=>localStorage.getItem(key),oldKey)).toBe(saved);expect(attempts).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath('gps-anterior-revision.png'),animations:'disabled'});
  writeFileSync(info.outputPath('legacy-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,retained:true,watcherStarted:false,attempts}));
});
