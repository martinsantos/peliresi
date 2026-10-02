import { _android as android, type BrowserContext, type Page } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';
import { chromeButtonPoint, dismissObservedChromePrompts, readNativeWindow } from './native-window.ts';

await assertCloudDatabase();
const output=path.join(process.env.QA_ARTIFACTS!,'android');
await mkdir(output,{recursive:true});
const fixture=JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!,'fixture.json'),'utf8'));
assert.equal(fixture.database,'sitrep_night_qa_20260926');
execFileSync('adb',['reverse','tcp:4177','tcp:4177']);
execFileSync('adb',['shell','am','set-debug-app','--persistent','com.android.chrome']);
execFileSync('adb',['shell','svc','power','stayon','true']);
const devices=await android.devices();
assert.equal(devices.length,1,'Exactly one actual Android OS device is required');
const device=devices[0];
android.setDefaultTimeout(25000);
const getprop=(key:string)=>execFileSync('adb',['shell','getprop',key],{encoding:'utf8'}).trim();
assert.equal(getprop('ro.build.version.sdk'),'35');
const chrome=execFileSync('adb',['shell','dumpsys','package','com.android.chrome'],{encoding:'utf8'});
assert.match(chrome,/versionName=/);
let context:BrowserContext;
let page:Page;
const errors:string[]=[];
const runtimeErrors:string[]=[];
const failedResponses:Array<{url:string;method:string;status:number;at:string}>=[];
let logoutAttempt=0;
const results:Array<{name:string;status:string;error?:string}>=[];
const saveResults=async(completed=false)=>writeFile(path.join(output,'result.json'),JSON.stringify({
  commit:process.env.GITHUB_SHA,startedOnActualAndroid:true,completed,results,consoleErrors:errors,runtimeErrors,failedResponses,
  passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,
  limitations:['Android emulator, not a physical phone','Authenticated flow uses Chrome and the isolated QA origin, not the release APK production session','No real microphone, noise, battery or cellular-network certification'],
},null,2));
const closeContext=async()=>{
  // Kill only this QA Chrome process first. CDP context.close() can hang while
  // an Android window changes size; no profile or session data is deleted.
  execFileSync('adb',['shell','am','force-stop','com.android.chrome'],{timeout:5000});
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([context?.close().catch(()=>{}),new Promise<void>(resolve=>{timer=setTimeout(resolve,5000);})]);}
  finally{clearTimeout(timer);}
};
const settleNativeChrome=()=>dismissObservedChromePrompts(output);
const nativeButtonTap=async(name:string,evidence:string)=>{
  const button=page.getByRole('button',{name,exact:true});
  await expect(button).toBeVisible();await expect(button).toBeEnabled();
  await button.scrollIntoViewIfNeeded();
  const xml=readNativeWindow();
  await writeFile(path.join(output,evidence+'-native.xml'),xml);
  await device.screenshot({path:path.join(output,evidence+'-device.png')});
  const point=chromeButtonPoint(xml,name);
  await writeFile(path.join(output,evidence+'-input.json'),JSON.stringify({
    name,point,input:'Android adb input tap at fresh native accessibility bounds',
    dom:await button.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),
      active:document.activeElement?.tagName,viewport:{width:innerWidth,height:innerHeight,
        visual:visualViewport?{height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null}})),
    form:await page.getByRole('dialog',{name:'Nueva inspección'}).locator('input,select,textarea').evaluateAll(elements=>
      elements.map(el=>({tag:el.tagName,label:el.closest('label')?.textContent?.trim(),
        value:(el as HTMLInputElement).value,checked:(el as HTMLInputElement).checked}))),
  },null,2));
  // run14 had a visible enabled footer but CDP touch produced no creation
  // request. Exercise the actual OS input using freshly observed bounds;
  // never invoke the handler, fabricate coordinates or ignore a failed POST.
  execFileSync('adb',['shell','input','tap',String(point.x),String(point.y)],{timeout:5000});
};
const observe=(target:Page)=>{
  target.setDefaultTimeout(20000);
  target.on('pageerror',e=>runtimeErrors.push(e.message));
  target.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  target.on('response',response=>{
    if(response.url().includes('/api/')&&response.status()>=400)failedResponses.push({
      url:response.url(),method:response.request().method(),status:response.status(),at:new Date().toISOString(),
    });
  });
};
const launch=async()=>{
  context=await device.launchBrowser({hasTouch:true,permissions:['geolocation'],
    geolocation:{latitude:-32.89,longitude:-68.84},args:['--no-first-run','--no-default-browser-check']});
  await context.addCookies([{name:'sitrep_qa_client',value:'127.11.20.2',url:'http://127.0.0.1:4177'}]);
  // Restart the existing QA tab, as a user reopening the app would. Creating a
  // second copy left the old inspection mounted behind the next user session.
  const restored=context.pages().filter(candidate=>candidate.url().startsWith('http://127.0.0.1:4177/'));
  assert.ok(restored.length<=1,'The isolated single-tab app scenario must not accumulate hidden copies');
  page=restored[0]||await context.newPage();observe(page);
};
const login=async(user:string)=>{
  // Presentation preferences only: the real form obtains every session.
  await page.addInitScript(()=>{
    for(const role of ['ADMIN','GENERADOR','TRANSPORTISTA','OPERADOR','ADMIN_GENERADOR','ADMIN_OPERADOR','ADMIN_TRANSPORTISTA','INSPECTOR'])
      localStorage.setItem('sitrep_onboarding_'+role,'true');
  });
  await page.goto('http://127.0.0.1:4177/app/login');
  await page.getByLabel('Correo electrónico o CUIT').fill(user+'@night-qa.invalid');
  await page.getByLabel('Contraseña',{exact:true}).fill('OnlyLocal-NightQA-2026!');
  const [response]=await Promise.all([
    page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST'),
    page.getByRole('button',{name:'Ingresar',exact:true}).tap(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login$/);
  await settleNativeChrome();
  // The user-approved first-login welcome is a real UI step, not an error.
  const welcome=page.getByRole('button',{name:'Saltar introducción',exact:true});
  await expect(welcome).toBeVisible({timeout:7000});
  await welcome.tap();
  await expect(welcome).toHaveCount(0);
};
const logout=async()=>{
  const attempt=++logoutAttempt;
  await settleNativeChrome();
  await page.getByRole('button',{name:'Abrir menu',exact:true}).tap();
  const button=page.getByRole('button',{name:'Cerrar Sesión',exact:true});
  await expect(button).toBeVisible();await expect(button).toBeEnabled();
  await button.scrollIntoViewIfNeeded();
  await writeFile(path.join(output,`logout-${attempt}-geometry.json`),JSON.stringify(await button.evaluate(el=>{
    const rect=el.getBoundingClientRect();const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
    return {rect:rect.toJSON(),hit:hit?.outerHTML,viewport:{width:innerWidth,height:innerHeight,
      visual:visualViewport?{height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null}};
  }),null,2));
  await settleNativeChrome();
  await writeFile(path.join(output,`logout-${attempt}-native-before.xml`),readNativeWindow());
  await device.screenshot({path:path.join(output,`logout-${attempt}-before-device.png`)});
  // A web control is touched through the normal browser input path. Android's
  // accessibility snapshot can temporarily report zero bounds for this button;
  // do not fabricate native coordinates or invoke the handler directly.
  await button.tap();
  await expect(page).toHaveURL(/\/app\/login$/);
  expect(await page.evaluate(()=>localStorage.getItem('sitrep_access_token'))).toBeNull();
};
const proof=async(name:string)=>{
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:path.join(output,name+'.png')});
  await settleNativeChrome();
  await device.screenshot({path:path.join(output,name+'-device.png')});
};
const check=async(name:string,task:()=>Promise<void>)=>{
  try{await task();results.push({name,status:'PASS'});console.log('PASS Android '+name);}
  catch(e){const error=e instanceof Error?e.message:String(e);results.push({name,status:'FAIL',error});
    console.error('FAIL Android '+name+': '+error);
    await page?.screenshot({path:path.join(output,name+'-FAIL.png'),timeout:5000}).catch(()=>{});
  }
  await saveResults();
};
let inspection:{id:string;numero:string};
try{
  await launch();
  await check('real-os-and-admin-session',async()=>{
    await login('admin');
    const deviceInfo=await page.evaluate(()=>({agent:navigator.userAgent,width:innerWidth,height:innerHeight,secure:isSecureContext}));
    expect(deviceInfo.agent).toContain('Android');expect(deviceInfo.secure).toBe(true);
    await writeFile(path.join(output,'device.json'),JSON.stringify({
      android:getprop('ro.build.version.release'),sdk:getprop('ro.build.version.sdk'),
      model:device.model(),chrome:chrome.match(/versionName=([^\s]+)/)?.[1],
      ...deviceInfo,physicalDevice:false,installedReleaseApkTested:false,geolocationEmulated:true,
    },null,2));await proof('admin-session');
  });
  await check('real-impersonation-reload-and-return-to-administrator',async()=>{
    await page.goto('http://127.0.0.1:4177/app/switch-user');
    await page.getByLabel('Buscar usuario').fill('operador@night-qa.invalid');
    const target=page.getByRole('region',{name:'Operador',exact:true})
      .getByRole('button').filter({hasText:'QA Operador 1'});
    await expect(target).toHaveCount(1);
    const [switched,profile]=await Promise.all([
      page.waitForResponse(r=>r.url().includes('/api/admin/impersonate/')&&r.request().method()==='POST'),
      page.waitForResponse(r=>r.url().endsWith('/api/auth/profile')&&r.request().method()==='GET'),
      target.tap(),
    ]);
    expect(switched.status()).toBe(200);expect(profile.status()).toBe(200);
    const operator=(await profile.json()).data.user;
    expect(operator.email).toBe('operador@night-qa.invalid');expect(operator.rol).toBe('OPERADOR');
    await expect(page.getByTestId('impersonation-banner')).toContainText(operator.nombre);
    const [restored]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/auth/profile')&&r.request().method()==='GET'),page.reload(),
    ]);
    expect((await restored.json()).data.user.email).toBe('operador@night-qa.invalid');
    await proof('temporary-operator-session');
    const [administrator]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/auth/profile')&&r.request().method()==='GET'),
      page.getByRole('button',{name:'Volver a mi cuenta',exact:true}).tap(),
    ]);
    const returned=(await administrator.json()).data.user;
    expect(returned.email).toBe('admin@night-qa.invalid');expect(returned.rol).toBe('ADMIN');
    await expect(page.getByTestId('impersonation-banner')).toHaveCount(0);
    await proof('administrator-restored');
  });
  await check('control-monitor-reports-actual-data',async()=>{
    for(const[route,endpoint]of [
      ['centro-control','/api/centro-control/actividad'],['monitor','/api/centro-control/monitor-live'],
      ['reportes','/api/reportes/manifiestos'],
    ]){
      const [received]=await Promise.all([
        page.waitForResponse(r=>r.url().includes(endpoint)&&r.status()===200),
        page.goto('http://127.0.0.1:4177/app/'+route),
      ]);
      const actual=(await received.json()).data;
      expect(actual).toBeTruthy();await expect(page.locator('body')).not.toBeEmpty();
      await proof(route);
    }
  });
  await check('assigned-spontaneous-inspection',async()=>{
    await page.goto('http://127.0.0.1:4177/app/inspecciones');
    await page.getByRole('button',{name:'Nueva inspección',exact:true}).tap();
    await page.getByRole('combobox',{name:'Tipo de inspección',exact:true}).selectOption('ESPONTANEA');
    const inspector=page.getByRole('combobox',{name:'Inspector asignado',exact:true});
    await inspector.selectOption({label:'QA inspector'});
    await page.getByLabel('Descripción inicial').fill('QA Android: hallazgo sintético, sin envíos externos');
    await page.getByLabel('Ubicación prevista').fill('QA ubicación ficticia');
    const [saved]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/inspecciones')&&r.request().method()==='POST'),
      nativeButtonTap('Crear expediente','create-inspection'),
    ]);
    expect(saved.status()).toBe(201);inspection=(await saved.json()).data;
    expect(inspection.numero).toMatch(/^IRP-\d{4}-\d{5}$/);
    await proof('created-inspection');await logout();
  });
  await check('inspector-receives-real-notice-and-opens-dossier',async()=>{
    assert.ok(inspection?.id);
    await login('inspector');
    await page.getByRole('banner').getByRole('button',{name:/^Notificaciones/}).tap();
    await page.getByRole('button',{name:'Ver todas las notificaciones',exact:true}).tap();
    await page.getByRole('button',{name:'Abrir aviso: Inspección asignada · '+inspection.numero,exact:true}).tap();
    await expect(page).toHaveURL(new RegExp('/app/inspecciones/'+inspection.id+'$'));
    await proof('inspector-notice-open');
  });
  await check('start-field-and-save-observation',async()=>{
    assert.ok(inspection?.id);
    const [started]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/inspecciones/'+inspection.id+'/estado')&&r.request().method()==='POST'),
      page.getByRole('button',{name:'Iniciar visita',exact:true}).tap(),
    ]);
    expect(started.status()).toBe(200);
    await page.getByRole('navigation',{name:'Secciones del expediente'}).getByRole('link',{name:'Registro',exact:true}).tap();
    await page.locator('#inspection-observations').fill('QA Android comentario conservado después de cerrar Chrome.');
    const [saved]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/inspecciones/'+inspection.id+'/borrador')&&r.request().method()==='PATCH'),
      page.getByRole('button',{name:'Guardar cambios',exact:true}).tap(),
    ]);
    expect(saved.status()).toBe(200);
    await expect(page.getByText('Cambios confirmados en el servidor',{exact:true})).toBeVisible();
    await proof('saved-field-observation');
  });
  await check('process-restart-keeps-real-session-and-record',async()=>{
    assert.ok(inspection?.id);
    await closeContext();
    await launch();
    await page.goto('http://127.0.0.1:4177/app/inspecciones/'+inspection.id+'#acta');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.locator('#inspection-observations')).toHaveValue('QA Android comentario conservado después de cerrar Chrome.');
    await expect(page.getByRole('button',{name:'Saltar introducción',exact:true})).toHaveCount(0);
    await proof('restarted-inspector-record');
  });
  await check('logout-removes-access-to-protected-route',async()=>{
    await logout();
    await page.goto('http://127.0.0.1:4177/app/inspecciones/'+inspection.id);
    await expect(page).toHaveURL(/\/app\/login$/);await proof('logged-out');
  });
  const gpsResponses:Array<{status:number;latitude:number;longitude:number}>=[];
  await check('carrier-gps-sends-observed-location-to-real-api',async()=>{
    await login('transportista');
    page.on('response',response=>{
      if(response.url().endsWith('/manifiestos/'+fixture.deviceManifest.id+'/ubicacion')&&response.request().method()==='POST'){
        const body=response.request().postDataJSON();gpsResponses.push({status:response.status(),latitude:body.latitud,longitude:body.longitud});
      }
    });
    await page.goto('http://127.0.0.1:4177/app/transporte/viaje/'+fixture.deviceManifest.id);
    await expect(page.getByText('GPS activo',{exact:true}).first()).toBeVisible();
    await expect.poll(()=>gpsResponses.length,{timeout:45000}).toBeGreaterThan(0);
    expect(gpsResponses[0]).toEqual({status:200,latitude:-32.89,longitude:-68.84});
    await proof('carrier-gps-online');
  });
  await check('gps-offline-queue-survives-and-synchronizes-after-reconnection',async()=>{
    const key='gps_pending_'+fixture.deviceManifest.id;
    try{
      await context.setOffline(true);
      await context.setGeolocation({latitude:-32.891,longitude:-68.841});
      await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]').length,key),{timeout:45000}).toBeGreaterThan(0);
      await expect(page.getByText('Guardando local',{exact:true}).first()).toBeVisible();
      await proof('gps-offline-protected');
    }finally{await context.setOffline(false);}
    await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),key),{timeout:45000}).toBeNull();
    expect(gpsResponses.some(row=>row.status===200&&row.latitude===-32.891&&row.longitude===-68.841)).toBe(true);
    await writeFile(path.join(output,'gps-requests.json'),JSON.stringify(gpsResponses,null,2));
    await writeFile(path.join(output,'chrome-memory.txt'),execFileSync('adb',['shell','dumpsys','meminfo','com.android.chrome'],{encoding:'utf8',timeout:10000}));
    await proof('gps-reconnected');
  });
  await check('scanner-no-camera-remains-recoverable-on-Android',async()=>{
    await context.grantPermissions(['camera','geolocation']);
    await page.goto('http://127.0.0.1:4177/app/escaner-qr');
    // This emulator explicitly has camera-back/front none. Decoder success is
    // tested separately with a synthetic optical stream in browser E2E.
    await expect(page.getByText('No se detecto ninguna camara en este dispositivo.',{exact:true})).toBeVisible();
    await proof('scanner-without-hardware');
    await page.getByRole('button',{name:'Cerrar escaner',exact:true}).tap();
    await expect(page).not.toHaveURL(/escaner-qr$/);
  });
  await check('javascript-health',async()=>{
    assert.ok(results.some(result=>result.name==='real-os-and-admin-session'&&result.status==='PASS'), 'A real authenticated session must have run');
    // Failed transport while deliberately offline is expected; JS exceptions
    // are still rejected. Record all console messages in the artifact.
    expect(errors.filter(error=>!/^Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(error))).toEqual([]);
    expect(runtimeErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });
}finally{
  await saveResults(true);
  await closeContext();await device.close();
}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
