import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase} from '../safety';
import {login,prefix} from './helpers';

test.beforeAll(async()=>{await assertCloudDatabase();});

async function queue(page:Page){
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('sitrep_offline_db',5);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    try{return await new Promise<any[]>((resolve,reject)=>{
      const request=db.transaction('sync_queue','readonly').objectStore('sync_queue').getAll();
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });}finally{db.close();}
  });
}

test('an offline delivery waits for its original role after the same account changes role',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'sync-role-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const page=await context.newPage(),holder=await context.newPage();
  const errors:string[]=[],statuses:number[]=[];let attempts=0;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`))attempts++;});
  page.on('response',response=>{if(response.request().method()==='POST'&&response.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`))statuses.push(response.status());});
  await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    watchPosition(){return 1;},getCurrentPosition(){},clearWatch(){},
  }}));
  try{
    await login(page,info,'draft-multirole-20261024');
    if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
    await page.goto(mp+'/mi-perfil');
    await page.getByRole('button',{name:'Usar Transportista',exact:true}).click();
    await expect(page.getByRole('button',{name:'Transportista · En uso',exact:true})).toBeDisabled();
    await page.goto(`${mp}/transporte/viaje/${manifest.id}`);
    await expect(page.getByRole('button',{name:'Confirmar entrega',exact:true}).first()).toBeVisible();
    await holder.route('**/__qa-sync-holder',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>QA</title>'}));
    await holder.goto('/__qa-sync-holder');
    await holder.evaluate((owner:string)=>{
      let release!:()=>void,held=false;const gate=new Promise<void>(resolve=>{release=resolve;});
      (window as any).__qaHold={held:()=>held,release:()=>release()};
      void navigator.locks.request(`sitrep:offline-sync:${encodeURIComponent(owner)}`,{mode:'exclusive'},async()=>{held=true;await gate;});
    },String(fixture.owner));
    await expect.poll(()=>holder.evaluate(()=>(window as any).__qaHold.held())).toBe(true);
    await context.setOffline(true);
    await page.getByRole('button',{name:'Confirmar entrega',exact:true}).first().click();
    await page.getByRole('dialog',{name:/Confirmar Entrega/}).getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();
    await expect.poll(()=>queue(page)).toHaveLength(1);
    await context.setOffline(false);
    await page.goto(mp+'/mi-perfil');
    await page.getByRole('button',{name:'Usar Generador',exact:true}).click();
    await expect(page.getByRole('button',{name:'Generador · En uso',exact:true})).toBeDisabled();
    await holder.evaluate(()=>(window as any).__qaHold.release());
    // Let automatic sync run; if an earlier wait timed out, exercise the visible retry.
    await page.waitForTimeout(3000);
    const retry=page.getByRole('button',{name:'Reintentar',exact:true}).first();
    if(attempts===0&&await retry.isVisible()&&await retry.isEnabled())await retry.click();
    await page.waitForTimeout(3000);
    const remaining=await queue(page);
    writeFileSync(info.outputPath('role-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,attempts,statuses,
      remaining:remaining.map(item=>({failureKind:item.failureKind??null,attempts:item.attempts??0}))}));
    await page.screenshot({path:info.outputPath('rol-generador-cola.png'),animations:'disabled'});
    expect(attempts,'No debe intentar la entrega con otra actividad').toBe(0);
    expect(remaining,'Debe conservar la entrega al cambiar de actividad').toHaveLength(1);
    expect(remaining[0].contextOwner,'La entrega debe guardar su contexto original').toBeTruthy();
    const contextNotice=page.getByRole('status').filter({hasText:'Volvé a Transporte y, si corresponde'});
    await expect(contextNotice).toBeVisible();
    await expect(contextNotice.getByRole('button',{name:'Reintentar',exact:true})).toHaveCount(0);
    const confirmed=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`),{timeout:30_000});
    await page.getByRole('button',{name:'Usar Transportista',exact:true}).click();
    expect((await confirmed).status()).toBe(200);
    await expect.poll(()=>queue(page)).toEqual([]);
    expect(attempts).toBe(1);
    expect(errors).toEqual([]);
  }finally{await context.setOffline(false).catch(()=>{});await holder.evaluate(()=>(window as any).__qaHold?.release?.()).catch(()=>{});await context.close();}
});

test('an older delivery rejected under the wrong role is retained and can be retried in personal transport',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'sync-role-private.json'),'utf8'));
  const manifest=fixture.legacy[info.project.name],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const page=await context.newPage();let attempts=0;const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`))attempts++;});
  try{
    await login(page,info,'draft-multirole-20261024');
    if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
    await page.goto(mp+'/mi-perfil');
    await expect(page.getByRole('button',{name:'Generador · En uso',exact:true})).toBeDisabled();
    await expect.poll(async()=>{try{await queue(page);return true;}catch{return false;}}).toBe(true);
    expect(await queue(page)).toEqual([]);
    await page.evaluate(async({id,owner})=>{
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('sitrep_offline_db',5);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      try{await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction('sync_queue','readwrite');
        tx.objectStore('sync_queue').add({type:'POST',endpoint:`/manifiestos/${id}/confirmar-entrega`,data:{observaciones:'Entrega antigua artificial'},
          userId:owner,createdAt:new Date().toISOString(),failureKind:'auth',attempts:1,lastError:'No tiene permisos para realizar esta acción.'});
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      });}finally{db.close();}
    },{id:manifest.id,owner:String(fixture.owner)});
    await page.reload();
    const notice=page.getByRole('status').filter({hasText:'Hay cambios anteriores de Transporte'});
    await expect(notice).toBeVisible();await expect(notice.getByRole('button',{name:'Reintentar',exact:true})).toHaveCount(0);
    expect(attempts).toBe(0);expect(await queue(page)).toHaveLength(1);
    await page.getByRole('button',{name:'Usar Transportista',exact:true}).click();
    await expect(page.getByRole('button',{name:'Transportista · En uso',exact:true})).toBeDisabled();
    const authNotice=page.getByRole('status').filter({hasText:'El intento anterior no se pudo autorizar'});
    await expect(authNotice).toBeVisible();
    const response=page.waitForResponse(item=>item.request().method()==='POST'&&item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`),{timeout:30_000});
    await authNotice.getByRole('button',{name:'Reintentar',exact:true}).click();
    expect((await response).status()).toBe(200);await expect.poll(()=>queue(page)).toEqual([]);
    expect(attempts).toBe(1);expect(errors).toEqual([]);
    writeFileSync(info.outputPath('legacy-role-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,attempts,remaining:0}));
  }finally{await context.close();}
});
