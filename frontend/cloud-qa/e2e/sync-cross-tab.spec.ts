import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase} from '../safety';
import {login,prefix} from './helpers';

test.beforeAll(async()=>{await assertCloudDatabase();});

async function queue(page:Page) {
  return page.evaluate(async()=>{
    if (!(await indexedDB.databases()).some(db=>db.name==='sitrep_offline_db'&&db.version===5)) throw new Error('La copia local todavía no está preparada');
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

async function addDelivery(page:Page,id:string,owner:string) {
  await page.evaluate(async({id,owner})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('sitrep_offline_db',5);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('sync_queue','readwrite');
      tx.objectStore('sync_queue').add({type:'POST',endpoint:`/manifiestos/${id}/confirmar-entrega`,
        data:{observaciones:'Entrega artificial para prueba de concurrencia'},userId:owner,createdAt:new Date().toISOString()});
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  },{id,owner});
}

test('a delayed second tab does not replay or restore an already confirmed offline delivery',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'gps-transition-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name]['admin-delivery'],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const first=await context.newPage(),second=await context.newPage();
  const errors:string[]=[],secondStatuses:number[]=[];let firstAttempts=0,releaseFirst=()=>{};
  const firstGate=new Promise<void>(resolve=>{releaseFirst=resolve;});
  first.on('pageerror',error=>errors.push(error.message));second.on('pageerror',error=>errors.push(error.message));
  second.on('response',response=>{if(response.request().method()==='POST'&&response.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`))secondStatuses.push(response.status());});
  await second.addInitScript(({id,owner}:{id:string;owner:string})=>{
    const native=navigator.locks.request.bind(navigator.locks);
    let release!:()=>void,waiting=0,finished=0,granted=0,lockName='';
    const gate=new Promise<void>(resolve=>{release=resolve;});
    (window as any).__syncGate={waiting:()=>waiting,finished:()=>finished,granted:()=>granted,lockName:()=>lockName,release:()=>release()};
    Object.defineProperty(navigator.locks,'request',{configurable:true,value:(name:string,options:LockOptions,callback:LockGrantedCallback<unknown>)=>{
      if((name===`sitrep:gps:${id}`||name===`sitrep:offline-sync:${encodeURIComponent(owner)}`)&&waiting===0){
        waiting++;lockName=name.startsWith('sitrep:offline-sync:')?'sync':'gps';
        return gate.then(()=>native(name,options,lock=>{if(lock)granted++;return callback(lock);})).finally(()=>{finished++;});
      }
      return native(name,options,callback);
    }});
  },{id:manifest.id,owner:String(fixture.owner)});
  try{
    await login(first,info,'transportista');
    if(info.project.name==='app'){await first.setViewportSize({width:320,height:800});await second.setViewportSize({width:320,height:800});}
    await expect.poll(async()=>{try{await queue(first);return true;}catch{return false;}}).toBe(true);
    expect(await queue(first)).toEqual([]);
    await addDelivery(first,manifest.id,String(fixture.owner));
    await first.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega`,async route=>{firstAttempts++;await firstGate;await route.continue();});
    const response=first.waitForResponse(item=>item.request().method()==='POST'&&item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`),{timeout:90_000}).catch(()=>null);
    await first.goto(mp+'/dashboard');
    await expect.poll(()=>firstAttempts,{timeout:30_000}).toBe(1);
    await second.goto(mp+'/dashboard');
    await expect.poll(()=>second.evaluate(()=>(window as any).__syncGate.waiting()),{timeout:30_000}).toBe(1);
    releaseFirst();expect((await response)?.status()).toBe(200);
    await expect.poll(()=>queue(first),{timeout:15_000}).toEqual([]);
    await second.evaluate(()=>(window as any).__syncGate.release());
    await expect.poll(()=>second.evaluate(()=>(window as any).__syncGate.finished()),{timeout:30_000}).toBe(1);
    expect(await second.evaluate(()=>(window as any).__syncGate.granted())).toBe(1);
    await second.waitForTimeout(1200);
    const remaining=await queue(second);
    await second.screenshot({path:info.outputPath('sync-segunda-pestana.png'),animations:'disabled'});
    writeFileSync(info.outputPath('sync-cross-tab-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,
      firstAttempts,secondStatuses,gate:await second.evaluate(()=>(window as any).__syncGate.lockName()),
      remaining:remaining.map(item=>({failureKind:item.failureKind??null,attempts:item.attempts??0}))}));
    expect(secondStatuses,'La segunda pestaña no debe reenviar una entrega ya confirmada').toEqual([]);
    expect(remaining,'Una acción confirmada no debe volver a la cola').toEqual([]);
    expect(errors).toEqual([]);
  }finally{releaseFirst();await second.evaluate(()=>(window as any).__syncGate?.release?.()).catch(()=>{});await context.close();}
});

test('a browser without coordination keeps the delivery and explains how to retry',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'gps-transition-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name]['fleet-delivery'],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const page=await context.newPage();let attempts=0;const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await login(page,info,'transportista');
    if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
    await expect.poll(async()=>{try{await queue(page);return true;}catch{return false;}}).toBe(true);
    expect(await queue(page)).toEqual([]);
    await addDelivery(page,manifest.id,String(fixture.owner));
    await page.route(`**/api/manifiestos/${manifest.id}/confirmar-entrega`,async route=>{attempts++;await route.abort('failed');});
    await page.addInitScript(()=>Object.defineProperty(navigator,'locks',{configurable:true,value:undefined}));
    await page.goto(mp+'/dashboard');
    const notice=page.getByRole('status').filter({hasText:'Este navegador no puede coordinar la sincronización'});
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('1 pendiente');
    await notice.getByRole('button',{name:'Reintentar',exact:true}).click();
    await expect(notice).toBeVisible();
    expect(attempts).toBe(0);expect(await queue(page)).toHaveLength(1);expect(errors).toEqual([]);
    await page.screenshot({path:info.outputPath('sin-coordinacion.png'),animations:'disabled'});
    writeFileSync(info.outputPath('unsupported-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,attempts,remaining:1}));
  }finally{await context.close();}
});

test('a busy synchronization explains the wait and completes after the other page finishes',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'gps-transition-private.json'),'utf8'));
  const manifest=fixture.cases[info.project.name]['fleet-other'],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const first=await context.newPage(),second=await context.newPage();let attempts=0;const errors:string[]=[];
  first.on('pageerror',error=>errors.push(error.message));second.on('pageerror',error=>errors.push(error.message));
  second.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`))attempts++;});
  try{
    await login(first,info,'transportista');
    if(info.project.name==='app'){await first.setViewportSize({width:320,height:800});await second.setViewportSize({width:320,height:800});}
    await expect.poll(async()=>{try{await queue(first);return true;}catch{return false;}}).toBe(true);
    expect(await queue(first)).toEqual([]);
    await first.evaluate((owner:string)=>{
      let release!:()=>void,held=false;const hold=new Promise<void>(resolve=>{release=resolve;});
      (window as any).__qaSyncHold={held:()=>held,release:()=>release()};
      void navigator.locks.request(`sitrep:offline-sync:${encodeURIComponent(owner)}`,{mode:'exclusive'},async()=>{held=true;await hold;});
    },String(fixture.owner));
    await expect.poll(()=>first.evaluate(()=>(window as any).__qaSyncHold.held())).toBe(true);
    await addDelivery(first,manifest.id,String(fixture.owner));
    await second.goto(mp+'/dashboard');
    const notice=second.getByRole('status').filter({hasText:'Otra ventana está sincronizando esta cuenta'});
    await expect(notice).toBeVisible({timeout:25_000});await expect(notice).toContainText('1 pendiente');
    expect(attempts).toBe(0);expect(await queue(second)).toHaveLength(1);
    await second.screenshot({path:info.outputPath('sincronizacion-en-otra-ventana.png'),animations:'disabled'});
    const response=second.waitForResponse(item=>item.request().method()==='POST'&&item.url().endsWith(`/manifiestos/${manifest.id}/confirmar-entrega`),{timeout:30_000});
    await first.evaluate(()=>(window as any).__qaSyncHold.release());
    // A remount can already have queued an automatic retry. If the notice is
    // still available, ask for a retry; otherwise observe the in-flight one.
    await second.waitForTimeout(500);
    const retry=notice.getByRole('button',{name:'Reintentar',exact:true});
    if(attempts===0&&await retry.isVisible()&&await retry.isEnabled()){
      try{await retry.click({timeout:2000});}catch(error){if(attempts===0)throw error;}
    }
    expect((await response).status()).toBe(200);await expect.poll(()=>queue(second)).toEqual([]);
    expect(attempts).toBe(1);expect(errors).toEqual([]);
    writeFileSync(info.outputPath('busy-sync-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,attempts,remaining:0}));
  }finally{await first.evaluate(()=>(window as any).__qaSyncHold?.release?.()).catch(()=>{});await context.close();}
});

test('a local database error is visible even when its pending count is unknown',async({browser},info)=>{
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await login(page,info,'transportista');
    if(info.project.name==='app')await page.setViewportSize({width:320,height:800});
    await page.addInitScript(()=>{
      const native=indexedDB.open.bind(indexedDB);
      Object.defineProperty(indexedDB,'open',{configurable:true,value:(name:string,version?:number)=>{
        if(name==='sitrep_offline_db')throw new DOMException('No se pudo abrir la copia local.','InvalidStateError');
        return native(name,version);
      }});
    });
    await page.goto(prefix(info)+'/dashboard');
    const notice=page.getByRole('status').filter({hasText:'No pudimos revisar la sincronización'});
    await expect(notice).toBeVisible();await expect(notice).toContainText('No se pudo abrir la copia local.');
    await notice.getByRole('button',{name:'Reintentar',exact:true}).click();await expect(notice).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({path:info.outputPath('copia-local-no-disponible.png'),animations:'disabled'});
    writeFileSync(info.outputPath('storage-error-proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,visible:true}));
  }finally{await context.close();}
});
