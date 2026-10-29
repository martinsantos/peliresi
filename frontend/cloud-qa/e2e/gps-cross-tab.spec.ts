import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase} from '../safety';
import {login,prefix} from './helpers';

test.beforeAll(async()=>{await assertCloudDatabase();});
async function installGps(page:Page){
  await page.addInitScript(()=>{
    let watcher:PositionCallback|undefined,coarse:PositionCallback|undefined;
    (window as any).__crossGps={ready:()=>Boolean(watcher&&coarse),emit:()=>watcher?.({
      coords:{latitude:-33.61,longitude:-68.61,accuracy:10,speed:null,heading:null,altitude:null,altitudeAccuracy:null},timestamp:Date.now(),
    } as GeolocationPosition)};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
      watchPosition(callback:PositionCallback){watcher=callback;return 1;},
      getCurrentPosition(callback:PositionCallback){coarse=callback;},clearWatch(){watcher=undefined;},
    }});
  });
}

test('another tab cannot deliver while an active GPS screen can create an unsent point',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'gps-transition-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name]['fleet-delivery'],mp=prefix(info);
  const queueKey=`sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner),manifest.id]))}`;
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const tracking=await context.newPage(),delivery=await context.newPage();
  let gpsAttempts=0,transitions=0,releaseGate=()=>{};
  const gate=new Promise<void>(resolve=>{releaseGate=resolve;});
  const errors:string[]=[];tracking.on('pageerror',error=>errors.push(error.message));delivery.on('pageerror',error=>errors.push(error.message));
  await installGps(tracking);
  await tracking.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`,async route=>{gpsAttempts++;await route.abort('failed');});
  await delivery.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega`,async route=>{transitions++;await gate;await route.continue();});
  try{
    await login(tracking,info,'transportista');
    if(info.project.name==='app'){await tracking.setViewportSize({width:320,height:800});await delivery.setViewportSize({width:320,height:800});}
    await tracking.goto(`${mp}/transporte/viaje/${manifest.id}`);
    await expect.poll(()=>tracking.evaluate(()=>(window as any).__crossGps.ready())).toBe(true);
    await delivery.goto(mp+'/transporte/cargas');
    await delivery.getByRole('searchbox',{name:'Número de manifiesto'}).fill(manifest.numero);
    await delivery.getByRole('button',{name:'Buscar',exact:true}).click();
    await delivery.getByRole('checkbox',{name:`Llevo ${manifest.numero} en este móvil`,exact:true}).check();
    await delivery.getByRole('button',{name:`Entregar ${manifest.numero}`,exact:true}).click();
    const dialog=delivery.getByRole('dialog',{name:'Confirmar entrega',exact:true});
    const response=delivery.waitForResponse(item=>item.request().method()==='POST'&&item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`),{timeout:90_000}).catch(()=>null);
    await dialog.getByRole('button',{name:'Confirmar entrega de esta carga',exact:true}).click();
    await expect.poll(async()=>transitions>0||await dialog.getByRole('alert').isVisible()).toBe(true);
    const blocked=transitions===0;
    if(blocked)await expect(dialog.getByRole('alert')).toContainText(/otra pestaña|otra ventana/i);

    await tracking.evaluate(()=>(window as any).__crossGps.emit());
    // Use the real 30-second sender: a fake clock also freezes the other tab.
    await expect.poll(()=>gpsAttempts,{timeout:45_000}).toBe(1);
    await expect.poll(()=>tracking.evaluate(key=>localStorage.getItem(key),queueKey)).not.toBeNull();
    const pending=await tracking.evaluate(key=>JSON.parse(localStorage.getItem(key)!),queueKey);
    expect(pending).toHaveLength(1);expect(pending[0]).toMatchObject({lat:-33.61,lng:-68.61,puntoId:expect.any(String)});
    if(blocked){
      await tracking.close();
      await expect.poll(async()=>delivery.evaluate(async id=>{
        const state=await navigator.locks.query();return !state.held.some(lock=>lock.name===`sitrep:gps:${id}`);
      },manifest.id)).toBe(true);
      releaseGate();
      await dialog.getByRole('button',{name:'Confirmar entrega de esta carga',exact:true}).click();
    }else releaseGate();
    expect((await response)?.status()).toBe(200);
    const left=await delivery.evaluate(key=>localStorage.getItem(key),queueKey);
    writeFileSync(info.outputPath('cross-tab-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,blockedBeforeTransition:blocked,
      gpsAttempts,transitions,pendingAfterDelivery:left!==null}));
    expect(left,'No debe quedar una ubicación sin enviar después de confirmar la entrega').toBeNull();
    expect(errors).toEqual([]);
  }finally{releaseGate();await context.close();}
});

test('closing a GPS screen preserves its latest fix before the timed send',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'gps-transition-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name]['fleet-other'],mp=prefix(info);
  const queueKey=`sitrep_gps_v2_${encodeURIComponent(JSON.stringify([String(fixture.owner),manifest.id]))}`;
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const tracking=await context.newPage(),delivery=await context.newPage();let trackingRequests=0;
  const errors:string[]=[];tracking.on('pageerror',error=>errors.push(error.message));delivery.on('pageerror',error=>errors.push(error.message));
  await installGps(tracking);
  await tracking.route(`**/api/manifiestos/${manifest.id}/ubicacion-idempotente`,async route=>{trackingRequests++;await route.abort('failed');});
  try{
    await login(tracking,info,'transportista');
    if(info.project.name==='app'){await tracking.setViewportSize({width:320,height:800});await delivery.setViewportSize({width:320,height:800});}
    await tracking.goto(`${mp}/transporte/viaje/${manifest.id}`);
    await expect.poll(()=>tracking.evaluate(()=>(window as any).__crossGps.ready())).toBe(true);
    await delivery.goto(mp+'/transporte/cargas');
    await delivery.getByRole('searchbox',{name:'Número de manifiesto'}).fill(manifest.numero);
    await delivery.getByRole('button',{name:'Buscar',exact:true}).click();
    await delivery.getByRole('checkbox',{name:`Llevo ${manifest.numero} en este móvil`,exact:true}).check();
    await delivery.getByRole('button',{name:`Entregar ${manifest.numero}`,exact:true}).click();
    const dialog=delivery.getByRole('dialog',{name:'Confirmar entrega',exact:true});
    await dialog.getByRole('button',{name:'Confirmar entrega de esta carga',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText(/otra pestaña|otra ventana/i);
    await delivery.screenshot({path:info.outputPath('gps-bloqueo-otra-pestana.png'),animations:'disabled'});
    await tracking.evaluate(()=>(window as any).__crossGps.emit());
    expect(trackingRequests).toBe(0);
    expect(await tracking.evaluate(key=>localStorage.getItem(key),queueKey)).toBeNull();
    await tracking.close({runBeforeUnload:true});
    await expect.poll(()=>delivery.evaluate(key=>localStorage.getItem(key),queueKey)).not.toBeNull();
    const pending=await delivery.evaluate(key=>JSON.parse(localStorage.getItem(key)!),queueKey);
    expect(pending).toHaveLength(1); expect(pending[0]).toMatchObject({lat:-33.61,lng:-68.61,puntoId:expect.any(String)});
    await expect.poll(async()=>delivery.evaluate(async id=>{
      const state=await navigator.locks.query();return !state.held.some(lock=>lock.name===`sitrep:gps:${id}`);
    },manifest.id)).toBe(true);
    const response=delivery.waitForResponse(item=>item.request().method()==='POST'&&item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`));
    await dialog.getByRole('button',{name:'Confirmar entrega de esta carga',exact:true}).click();
    expect((await response).status()).toBe(200);
    expect(await delivery.evaluate(key=>localStorage.getItem(key),queueKey)).toBeNull();
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('close-before-send-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,trackingRequestsBeforeClose:trackingRequests,pendingAfterDelivery:false}));
  }finally{await context.close();}
});
