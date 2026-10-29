import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { login, prefix } from './helpers';

test.beforeAll(async()=>{await assertCloudDatabase();});
const fixture=()=>JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'gps-order-private.json'),'utf8'));
async function installGps(page:Page){
  await page.clock.install();
  await page.addInitScript(()=>{
    let watch:PositionCallback|undefined;
    (window as any).__qaGps={ready:()=>Boolean(watch),emit:(lat:number,lon:number,time:number)=>watch?.({
      coords:{latitude:lat,longitude:lon,accuracy:10,speed:null,heading:null,altitude:null,altitudeAccuracy:null},timestamp:time,
    } as GeolocationPosition)};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(callback:PositionCallback){watch=callback;return 1;},clearWatch(){watch=undefined;}}});
  });
}
async function eightReplays(page:Page,url:string,token:string,body:Record<string,unknown>){
  const settled=await Promise.allSettled(Array.from({length:8},()=>page.request.post(url,{headers:{Authorization:`Bearer ${token}`},data:body})));
  const failures=settled.filter((result):result is PromiseRejectedResult=>result.status==='rejected');
  const responses=settled.filter((result):result is PromiseFulfilledResult<import('@playwright/test').APIResponse>=>result.status==='fulfilled').map(result=>result.value);
  // A real connection failure is retried with the exact same reference. Its
  // count is recorded; the independent DB audit checks the single stored row.
  for(const _failure of failures)responses.push(await page.request.post(url,{headers:{Authorization:`Bearer ${token}`},data:body}));
  expect(responses.map(response=>response.status())).toEqual(Array(8).fill(200));
  const data=await Promise.all(responses.map(async response=>(await response.json()).data));
  expect(new Set(data.map(item=>item.tracking.id)).size).toBe(1);
  expect(data.filter(item=>item.idempotencia.repetido===false).length).toBeLessThanOrEqual(1);
  expect(data.every(item=>item.idempotencia.puntoId===body.puntoId)).toBe(true);
  const conflict=await page.request.post(url,{headers:{Authorization:`Bearer ${token}`},data:{...body,latitud:-34.99}});
  expect(conflict.status()).toBe(409);
  return failures.length;
}

test('fleet retries the accepted point without a duplicate and continues the other load',async({browser},info)=>{
  const cases=fixture().cases[info.project.name],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const page=await context.newPage(),payloads:any[]=[],answers:any[]=[],errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));await installGps(page);
  try{
    await login(page,info,'transportista');
    if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
    const access=await page.evaluate(()=>localStorage.getItem('sitrep_access_token'));expect(access).toBeTruthy();
    await page.goto(mp+'/transporte/cargas');
    await page.getByRole('searchbox',{name:'Número de manifiesto'}).fill(cases.prefix+'-FLEET');
    await page.getByRole('button',{name:'Buscar',exact:true}).click();
    for(const load of [cases.fleetA,cases.fleetB])await page.getByRole('checkbox',{name:`Llevo ${load.numero} en este móvil`,exact:true}).check();
    await page.route(`**/api/manifiestos/${cases.fleetA.id}/ubicacion-idempotente`,async route=>{
      payloads.push(route.request().postDataJSON());const response=await route.fetch();answers.push({status:response.status(),body:await response.json()});
      if(payloads.length===1)await route.abort('failed');else await route.fulfill({response});
    });
    await page.getByRole('button',{name:'Iniciar GPS',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as any).__qaGps.ready())).toBe(true);
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
    await page.evaluate(()=>(window as any).__qaGps.emit(-33.42,-68.42,Date.now()));
    const retry=page.getByRole('button',{name:`Reintentar envío GPS de ${cases.fleetA.numero}`});
    await expect(retry).toBeVisible();
    await expect(page.getByRole('region',{name:'Cargas marcadas'})).toContainText('GPS recibido');
    await retry.click();await expect.poll(()=>answers.length).toBe(2);
    await expect(retry).not.toBeVisible();
    await expect(page.getByRole('region',{name:'Cargas marcadas'}).getByRole('status').filter({hasText:'GPS recibido'})).toHaveCount(2);
    expect(payloads).toHaveLength(2);expect(payloads[0].puntoId).toBe(payloads[1].puntoId);
    expect(answers.map(answer=>answer.status)).toEqual([200,200]);
    expect(answers[0].body.data.idempotencia.repetido).toBe(false);expect(answers[1].body.data.idempotencia.repetido).toBe(true);
    await page.getByRole('region',{name:'Cargas marcadas'}).screenshot({path:info.outputPath('flota-reintento-confirmado.png')});
    await page.unrouteAll();
    const connectionFailures=await eightReplays(page,`/api/manifiestos/${cases.fleetA.id}/ubicacion-idempotente`,access!,{latitud:-33.44,longitud:-68.44,puntoId:randomUUID()});
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('fleet-proof.json'),JSON.stringify({surface:info.project.name,simulatedGps:true,responseLost:true,retryConfirmed:true,concurrent:8,connectionFailures}));
  }finally{await context.close();}
});

test('replacement GPS retries the accepted point and still rejects a revoked link',async({browser},info)=>{
  const data=fixture(),manifest=data.cases[info.project.name].relay,mp=prefix(info);
  const sourceContext=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,serviceWorkers:'block'});
  const relayContext=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const source=await sourceContext.newPage(),relay=await relayContext.newPage(),payloads:any[]=[],answers:any[]=[],errors:string[]=[];
  relay.on('pageerror',error=>errors.push(error.message));await installGps(relay);
  try{
    await login(source,info,'transportista');const token=await source.evaluate(()=>localStorage.getItem('sitrep_access_token'));expect(token).toBeTruthy();
    const command={
      id:randomUUID(),anteriorId:null,tipo:'REGISTRADO',transportistaId:data.replacementId,datos:{},motivo:'Relevo artificial para probar una respuesta perdida',
    };
    let creationFailures=0;
    const create=()=>source.request.post(`/api/manifiestos/${manifest.id}/tramos`,{headers:{Authorization:`Bearer ${token}`},data:command});
    const handoff=await create().catch(()=>{creationFailures++;return create();});expect(handoff.status()).toBe(201);
    const {tramo,acceso}=(await handoff.json()).data,url=`/api/seguimiento-relevo/${tramo.id}/ubicacion-idempotente`;
    await relay.route(`**${url}`,async route=>{
      payloads.push(route.request().postDataJSON());const response=await route.fetch();answers.push({status:response.status(),body:await response.json()});
      if(payloads.length===1)await route.abort('failed');else await route.fulfill({response});
    });
    if(info.project.name==='app')await relay.setViewportSize({width:320,height:800});
    await relay.goto(`${mp}/relevo/${tramo.id}#${acceso}`);
    await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect.poll(()=>relay.evaluate(()=>(window as any).__qaGps.ready())).toBe(true);
    await relay.clock.pauseAt(await relay.evaluate(()=>Date.now()+100));
    await relay.evaluate(()=>(window as any).__qaGps.emit(-33.52,-68.52,Date.now()));
    await expect(relay.getByRole('alert')).toBeVisible();
    await relay.clock.runFor(30_000);
    await expect(relay.getByRole('status')).toContainText('Ubicación recibida por SITREP');
    expect(payloads).toHaveLength(2);expect(payloads[0].puntoId).toBe(payloads[1].puntoId);
    expect(answers.map(answer=>answer.status)).toEqual([200,200]);
    expect(answers[0].body.data.idempotencia.repetido).toBe(false);expect(answers[1].body.data.idempotencia.repetido).toBe(true);
    await relay.screenshot({path:info.outputPath('relevo-reintento-confirmado.png'),animations:'disabled'});
    await relay.unrouteAll();
    const concurrent={latitud:-33.54,longitud:-68.54,precision:10,puntoId:randomUUID()};
    const connectionFailures=await eightReplays(relay,url,acceso,concurrent);
    const revoked=await source.request.post(`/api/manifiestos/${manifest.id}/tramos/${tramo.id}/acceso`,{headers:{Authorization:`Bearer ${token}`},data:{revocar:true}});
    expect(revoked.status()).toBe(200);
    const after=await relay.request.post(url,{headers:{Authorization:`Bearer ${acceso}`},data:concurrent});expect(after.status()).toBe(403);
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('relay-proof.json'),JSON.stringify({surface:info.project.name,simulatedGps:true,responseLost:true,retryConfirmed:true,concurrent:8,revoked:true,connectionFailures,creationFailures}));
  }finally{await sourceContext.close();await relayContext.close();}
});
