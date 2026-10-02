import { _android as android, type BrowserContext, type Page } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';

await assertCloudDatabase();
const output=path.join(process.env.QA_ARTIFACTS!,'android');
await mkdir(output,{recursive:true});
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
const results:Array<{name:string;status:string;error?:string}>=[];
const settleNativeChrome=async()=>{
  execFileSync('adb',['shell','uiautomator','dump','/data/local/tmp/sitrep-chrome-window.xml'],{timeout:45000});
  const native=execFileSync('adb',['shell','cat','/data/local/tmp/sitrep-chrome-window.xml'],{encoding:'utf8'});
  if(native.includes('Chrome notifications make things easier')){
    await device.tap({text:'No thanks'},{timeout:5000});
    await device.wait({text:'Chrome notifications make things easier'},{state:'gone',timeout:5000});
    console.log('Dismissed native Chrome first-run notification prompt on temporary emulator');
  }
};
const observe=(target:Page)=>{
  target.setDefaultTimeout(20000);
  target.on('pageerror',e=>errors.push(e.message));
  target.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
};
const launch=async()=>{
  context=await device.launchBrowser({hasTouch:true,permissions:['geolocation'],
    geolocation:{latitude:-32.89,longitude:-68.84},args:['--no-first-run','--no-default-browser-check']});
  await context.addCookies([{name:'sitrep_qa_client',value:'127.11.20.2',url:'http://127.0.0.1:4177'}]);
  page=await context.newPage();observe(page);
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
  await page.getByRole('button',{name:'Abrir menu',exact:true}).tap();
  await page.getByRole('button',{name:'Cerrar Sesión',exact:true}).tap();
  await expect(page).toHaveURL(/\/app\/login$/);
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
    await page?.screenshot({path:path.join(output,name+'-FAIL.png')}).catch(()=>{});
  }
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
      page.getByRole('button',{name:'Crear expediente',exact:true}).tap(),
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
    const [saved]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/inspecciones/'+inspection.id+'/borrador')&&r.request().method()==='PATCH'),
      page.locator('#inspection-observations').fill('QA Android comentario conservado después de cerrar Chrome.'),
    ]);
    expect(saved.status()).toBe(200);await proof('saved-field-observation');
  });
  await check('process-restart-keeps-real-session-and-record',async()=>{
    assert.ok(inspection?.id);
    await context.close();
    execFileSync('adb',['shell','am','force-stop','com.android.chrome']);
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
  await check('javascript-health',async()=>{
    assert.ok(results.some(result=>result.name==='real-os-and-admin-session'&&result.status==='PASS'), 'A real authenticated session must have run');
    expect(errors).toEqual([]);
  });
}finally{
  await writeFile(path.join(output,'result.json'),JSON.stringify({
    commit:process.env.GITHUB_SHA,startedOnActualAndroid:true,results,consoleErrors:errors,
    passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,
    limitations:['Android emulator, not a physical phone','Release APK/TWA installation and signature not tested','No real microphone, noise, battery or cellular-network certification'],
  },null,2));
  await context?.close().catch(()=>{});await device.close();
}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
