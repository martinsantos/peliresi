import { _android as android, type BrowserContext, type Locator, type Page } from 'playwright';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';
import { chromeButtonPoint, chromeRenderedButtonPoint, chromeButtonHasZeroBounds, dismissObservedChromePrompts, nativeKeyboardShown, readNativeWindow } from './native-window.ts';
import { DeadlineError, withinDeadline } from './deadline.ts';
import { renewAndroidConnection } from './android-connection.ts';
import { startSystemLog } from './system-log.ts';
import { beginSessionEvidence } from './session-evidence.ts';
import { nonObstructingNotices, readableWholeWords } from './e2e/helpers.ts';
import { expectedOfflineConsole, qaManifestIcon, type ConsoleObservation, type IconProof } from './network-health.ts';

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
let device=devices[0];
android.setDefaultTimeout(25000);
device.setDefaultTimeout(25000);
const getprop=(key:string)=>execFileSync('adb',['shell','getprop',key],{encoding:'utf8'}).trim();
assert.equal(getprop('ro.build.version.sdk'),'35');
const chrome=execFileSync('adb',['shell','dumpsys','package','com.android.chrome'],{encoding:'utf8'});
assert.match(chrome,/versionName=/);
let context:BrowserContext;
let page:Page;
const errors:string[]=[];
const consoleObservations:ConsoleObservation[]=[];
const deliberateOfflineContexts=new WeakSet<BrowserContext>();
const iconProofs:IconProof[]=[];
const runtimeErrors:string[]=[];
const failedResponses:Array<{url:string;method:string;status:number;at:string}>=[];
const iconTransportFailures:Array<{url:string;error:string|null;at:string;deliberatelyOffline:boolean}>=[];
const browserLifecycle:Array<{at:string;event:string;url?:string;expected:boolean}>=[];
const intentionalClosures=new WeakSet<BrowserContext>();
let inspectorUserId='';
let logoutAttempt=0;
let launches=0;
const results:Array<{name:string;status:string;error?:string}>=[];
const driverStages:Array<{stage:string;event:string;at:string;error?:string}>=[];
const sessionEvidence:Array<{launch:number;metadata:unknown}>=[];
let sessionEvidenceOverflow=false;
const driverStep=async<T>(stage:string,operation:()=>Promise<T>,milliseconds=25000):Promise<T>=>{
  const record=async(event:string,error?:string)=>{
    driverStages.push({stage,event,at:new Date().toISOString(),error});
    await writeFile(path.join(output,'driver-stages.json'),JSON.stringify(driverStages,null,2));
    console.log('Android driver '+stage+': '+event);
  };
  await record('started');
  try{const value=await withinDeadline(stage,milliseconds,operation);await record('completed');return value;}
  catch(error){await record('failed',String(error));throw error;}
};
const saveResults=async(completed=false)=>writeFile(path.join(output,'result.json'),JSON.stringify({
  commit:process.env.GITHUB_SHA,startedOnActualAndroid:true,completed,results,consoleErrors:errors,consoleObservations,iconProofs,iconTransportFailures,runtimeErrors,failedResponses,browserLifecycle,
  sessionEvidence,sessionEvidenceOverflow,
  passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,
  limitations:['Android emulator, not a physical phone','Authenticated flow uses Chrome and the isolated QA origin, not the release APK production session','No real microphone, noise, battery or cellular-network certification'],
},null,2));
const closeContext=async()=>{
  if(context)intentionalClosures.add(context);
  // Kill only this QA Chrome process first. CDP context.close() can hang while
  // an Android window changes size; no profile or session data is deleted.
  await driverStep('force-stop-Chrome',async()=>{
    execFileSync('adb',['shell','am','force-stop','com.android.chrome'],{timeout:5000});
  });
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await driverStep('detach-stopped-context',()=>Promise.race([context?.close().catch(()=>{}),new Promise<void>(resolve=>{timer=setTimeout(resolve,5000);})]));}
  finally{clearTimeout(timer);}
};
const settleNativeChrome=()=>dismissObservedChromePrompts(output);
const keyboardProof=async(shown:boolean,name:string)=>{
  let dump='';
  await expect.poll(async()=>{
    dump=await new Promise<string>((resolve,reject)=>execFile('adb',['shell','dumpsys','input_method'],{timeout:5000,encoding:'utf8'},(error,stdout)=>error?reject(error):resolve(stdout)));
    await writeFile(path.join(output,name+'-input-method.txt'),dump);
    return nativeKeyboardShown(dump);
  },{timeout:10000,message:'Actual OS keyboard visibility: '+name}).toBe(shown);
  await proof(name);
};
const nativeButtonTap=async(name:string,evidence:string,target?:Locator)=>{
  const button=target||page.getByRole('button',{name,exact:true});
  await expect(button).toBeVisible();await expect(button).toBeEnabled();
  await button.scrollIntoViewIfNeeded();
  // Keep the keyboard open. A visible DOM button can still lie behind it.
  await expect.poll(()=>button.evaluate(el=>{
    const r=el.getBoundingClientRect(),v=visualViewport;
    return r.width>0&&r.height>0&&r.top>=(v?.offsetTop||0)
      &&r.bottom<=(v?(v.offsetTop+v.height):innerHeight)
      &&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  })).toBe(true);
  await device.screenshot({path:path.join(output,evidence+'-device.png')});
  const xml=await readNativeWindow();
  await writeFile(path.join(output,evidence+'-native.xml'),xml);
  const dom=await button.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),
    active:document.activeElement?.tagName,viewport:{width:innerWidth,height:innerHeight,
      visual:visualViewport?{height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null},
    workspace:document.querySelector('[data-testid="inspection-workspace"]')?.getBoundingClientRect().toJSON(),
    scroll:document.querySelector('[data-inspection-scroll]')?.getBoundingClientRect().toJSON(),
    ancestors:Array.from((()=>{const rows:Element[]=[];let node:Element|null=el;while(node){rows.push(node);node=node.parentElement;}return rows;})())
      .map(node=>({tag:node.tagName,testId:node.getAttribute('data-testid'),className:node.getAttribute('class'),rect:node.getBoundingClientRect().toJSON(),height:getComputedStyle(node).height,maxHeight:getComputedStyle(node).maxHeight,overflow:getComputedStyle(node).overflow}))}));
  await writeFile(path.join(output,evidence+'-input.json'),JSON.stringify({
    name,input:'Android adb input tap at fresh native accessibility bounds',
    dom,
    form:await page.getByRole('dialog',{name:'Nueva inspección'}).locator('input,select,textarea').evaluateAll(elements=>
      elements.map(el=>({tag:el.tagName,label:el.closest('label')?.textContent?.trim(),
        value:(el as HTMLInputElement).value,checked:(el as HTMLInputElement).checked}))),
  },null,2));
  // Native snapshots take time. Recheck the current visual viewport, not only
  // the transient layout seen before the keyboard finished opening/panning.
  const visible=dom.viewport.visual;
  assert.ok(dom.rect.width>0&&dom.rect.height>0&&dom.rect.top>=(visible?.offsetTop||0)
    &&dom.rect.bottom<=(visible?visible.offsetTop+visible.height:dom.viewport.height),
    'A native tap requires the entire button inside the current visible viewport');
  const renderedName=target?await button.innerText():name;
  if(chromeButtonHasZeroBounds(xml,renderedName)){
    // Run128: the actual OS screenshot and DOM hit-test show Save, but UIA
    // assigns zero bounds. No native coordinate is usable. Use one ordinary
    // locator touch (no force/handler/fake ACK); the caller still requires the
    // real PATCH, persisted body and server acknowledgment. Never retry input.
    await writeFile(path.join(output,evidence+'-tap-point.json'),JSON.stringify({
      input:'standard Playwright DOM touch after positive viewport and hit-test',
      nativeBounds:'[0,0][0,0]',nativeCoordinateTap:false,name:renderedName,
    },null,2));
    await button.tap();return;
  }
  const point=target?chromeRenderedButtonPoint(xml,renderedName):chromeButtonPoint(xml,name);
  await writeFile(path.join(output,evidence+'-tap-point.json'),JSON.stringify(point,null,2));
  // run14 had a visible enabled footer but CDP touch produced no creation
  // request. Exercise the actual OS input using freshly observed bounds;
  // never invoke the handler, fabricate coordinates or ignore a failed POST.
  execFileSync('adb',['shell','input','tap',String(point.x),String(point.y)],{timeout:5000});
};
const observe=(target:Page)=>{
  target.setDefaultTimeout(20000);
  target.on('pageerror',e=>runtimeErrors.push(e.message));
  target.on('close',()=>browserLifecycle.push({at:new Date().toISOString(),event:'page-close',url:target.url(),expected:intentionalClosures.has(target.context())}));
  target.on('crash',()=>runtimeErrors.push('Android Chrome page crashed: '+target.url()));
  target.on('console',m=>{if(m.type()==='error'){
    errors.push(m.text());consoleObservations.push({text:m.text(),at:new Date().toISOString(),deliberatelyOffline:deliberateOfflineContexts.has(target.context())});
  }});
  target.on('response',response=>{
    if(response.url().includes('/api/')&&response.status()>=400)failedResponses.push({
      url:response.url(),method:response.request().method(),status:response.status(),at:new Date().toISOString(),
    });
  });
  target.on('requestfailed',request=>{
    if(request.url()===qaManifestIcon)iconTransportFailures.push({url:request.url(),error:request.failure()?.errorText||null,
      at:new Date().toISOString(),deliberatelyOffline:deliberateOfflineContexts.has(target.context())});
  });
};
const launch=async()=>{
  // The experimental device object owns CDP sockets and a background ADB poll.
  // Reusing it after force-stop produced an unresolved launch in run21. Renew
  // only that connection on each planned restart; do not retry a failed launch,
  // clear Chrome's data, inject storage or wait for its localStorage disk commit.
  if(launches>0)await driverStep('renew-device-transport',async()=>{
    device=await renewAndroidConnection(device,()=>android.devices());
  });
  context=await driverStep('launch-and-attach-Chrome',()=>device.launchBrowser({hasTouch:true,permissions:['geolocation'],
    geolocation:{latitude:-32.89,longitude:-68.84},args:['--no-first-run','--no-default-browser-check']}));
  launches++;
  const launchNumber=launches;
  await context.exposeBinding('sitrepQaRecordSessionEvidence',(_source,metadata:unknown)=>{
    if(sessionEvidence.length>=256){sessionEvidenceOverflow=true;return;}
    sessionEvidence.push({launch:launchNumber,metadata});
  });
  await context.addInitScript(beginSessionEvidence);
  await driverStep('set-QA-network-identity',()=>context.addCookies([{name:'sitrep_qa_client',value:'127.11.20.2',url:'http://127.0.0.1:4177'}]));
  // Restart the existing QA tab, as a user reopening the app would. Creating a
  // second copy left the old inspection mounted behind the next user session.
  const restored=context.pages().filter(candidate=>candidate.url().startsWith('http://127.0.0.1:4177/'));
  assert.ok(restored.length<=1,'The isolated single-tab app scenario must not accumulate hidden copies');
  page=restored[0]||await driverStep('open-single-QA-tab',()=>context.newPage());observe(page);
  // launchBrowser opens a native about:blank tab on every launch. Keep the
  // authenticated restart tab, close only observed blank tabs, and foreground
  // the actual QA page before mixing CDP and native OS input.
  for(const other of context.pages().filter(candidate=>candidate!==page)){
    assert.equal(other.url(),'about:blank','Never close an unknown or hidden business tab');
    await driverStep('close-observed-blank-tab',()=>other.close());
  }
  await driverStep('foreground-QA-tab',()=>page.bringToFront());
  assert.equal(context.pages().length,1,'Exactly one browser tab in this isolated scenario');
  const launched=context;
  context.on('close',()=>browserLifecycle.push({at:new Date().toISOString(),event:'context-close',expected:intentionalClosures.has(launched)}));
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
  // Chrome may raise its own notification introduction immediately after the
  // navigation. Dismiss only that observed OS prompt before reading web roles;
  // the native dialog hides the page accessibility tree, not the login result.
  await settleNativeChrome();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login$/);
  await settleNativeChrome();
  // The user-approved first-login welcome is a real UI step, not an error.
  const welcome=page.getByRole('button',{name:'Saltar introducción',exact:true});
  await expect(welcome).toBeVisible({timeout:7000});
  await welcome.tap();
  await expect(welcome).toHaveCount(0);
  return (await response.json()).data.user as {id:string};
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
  await writeFile(path.join(output,`logout-${attempt}-native-before.xml`),await readNativeWindow());
  await device.screenshot({path:path.join(output,`logout-${attempt}-before-device.png`)});
  // A web control is touched through the normal browser input path. Android's
  // accessibility snapshot can temporarily report zero bounds for this button;
  // do not fabricate native coordinates or invoke the handler directly.
  await button.tap();
  await expect(page).toHaveURL(/\/app\/login$/);
  expect(await page.evaluate(()=>localStorage.getItem('sitrep_access_token'))).toBeNull();
};
const proof=async(name:string)=>{
  await page.bringToFront();
  await expect(page).toHaveTitle(/SITREP/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:path.join(output,name+'.png')});
  await settleNativeChrome();
  await device.screenshot({path:path.join(output,name+'-device.png')});
  await writeFile(path.join(output,name+'-chrome-exits.txt'),execFileSync('adb',['shell','dumpsys','activity','exit-info','com.android.chrome'],{encoding:'utf8',timeout:5000}));
  // Native capture may outlive a disconnected CDP target. Do not mark a dead
  // page PASS merely because its DOM screenshot was taken a few seconds earlier.
  await expect(page).toHaveTitle(/SITREP/i);
};
const verifyManifestIcon=async()=>{
  const actual=await page.evaluate(async(url)=>{
    const response=await fetch(url,{cache:'no-store'}),bytes=await response.arrayBuffer();
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    const blob=URL.createObjectURL(new Blob([bytes],{type:response.headers.get('content-type')||''}));
    try{const image=new Image();image.src=blob;await image.decode();return {url,at:new Date().toISOString(),status:response.status,mime:response.headers.get('content-type')||'',width:image.naturalWidth,height:image.naturalHeight,sha256};}
    finally{URL.revokeObjectURL(blob);}
  },qaManifestIcon);
  const frozen=JSON.parse(await readFile(path.join(process.env.QA_ARTIFACTS!,'build-frozen.json'),'utf8'));
  expect(actual.status).toBe(200);expect(actual.mime.split(';')[0]).toBe('image/png');expect(actual.width).toBe(512);expect(actual.height).toBe(512);
  expect(actual.sha256).toBe(frozen.files.find((item:{file:string})=>item.file==='dist-app/icon-512.png')?.sha256);
  // Use the observer clock, like consoleObservations, not an emulator clock.
  iconProofs.push({...actual,at:new Date().toISOString()});await writeFile(path.join(output,'manifest-icon-proof.json'),JSON.stringify(iconProofs,null,2));
};
const check=async(name:string,task:()=>Promise<void>)=>{
  try{await task();results.push({name,status:'PASS'});console.log('PASS Android '+name);}
  catch(e){const error=e instanceof Error?e.message:String(e);results.push({name,status:'FAIL',error});
    console.error('FAIL Android '+name+': '+error);
    await page?.screenshot({path:path.join(output,name+'-FAIL.png'),timeout:5000}).catch(()=>{});
    // Retain OS evidence even when CDP has already disconnected. Do not turn
    // a browser crash into a passing check or reset its recorded failure.
    for(const [suffix,args]of [
      ['adb-devices.txt',['devices','-l']],
      ['chrome-pids.txt',['shell','pidof','com.android.chrome']],
      ['chrome-exits.txt',['shell','dumpsys','activity','exit-info','com.android.chrome']],
      ['chrome-memory.txt',['shell','dumpsys','meminfo','com.android.chrome']],
      ['chrome-system-log.txt',['logcat','-d','-t','400','-v','brief','ActivityManager:I','AndroidRuntime:E','chromium:E','*:S']],
      ['device.png',['exec-out','screencap','-p']],
    ]as const){
      try{await writeFile(path.join(output,name+'-FAIL-'+suffix),execFileSync('adb',[...args],{timeout:5000,maxBuffer:4*1024*1024}));}
      catch(capture){await writeFile(path.join(output,name+'-FAIL-'+suffix+'.error.txt'),String(capture));}
    }
  }
  await saveResults();
  // The transport remains unresolved after this deadline. Do not reuse it,
  // continue acting on a different context or disguise incomplete work as PASS.
  if(results.at(-1)?.status==='FAIL'&&results.at(-1)?.error?.startsWith('Android driver deadline exceeded:'))
    throw new DeadlineError(name,25000);
  // ADB loss closes the experimental driver even if Chrome remains alive.
  // Preserve the failing case, then stop: later cases on a dead context have
  // not run and must not be misreported as independent application failures.
  if(results.at(-1)?.status==='FAIL'&&page?.isClosed())
    throw new Error('Android driver connection lost after '+name+'; remaining cases not executed');
};
let inspection:{id:string;numero:string};
const stopSystemLog=await startSystemLog(output);
try{
  await launch();
  await check('real-os-and-admin-session',async()=>{
    await login('admin');
    await verifyManifestIcon();
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
      if(route==='centro-control'){
        const agenda=page.getByRole('region',{name:'Agenda y viajes',exact:true});
        for(const name of ['Viajes Activos','Viajes Realizados','Inspecciones']){
          const header=agenda.getByRole('button',{name:new RegExp('^'+name)});
          if(await header.getAttribute('aria-expanded')!=='true')await header.tap();
          await expect(agenda.locator('button[aria-expanded="true"]')).toHaveCount(1);
          await header.tap();
          await expect(agenda.locator('button[aria-expanded="true"]')).toHaveCount(0);
        }
      }
      await proof(route);
    }
  });
  await check('searchable-select-chooses-before-actual-Android-keyboard',async()=>{
    await page.goto('http://127.0.0.1:4177/app/manifiestos/nuevo');
    const trigger=page.getByRole('button',{name:'Generador *',exact:true});
    await trigger.tap();
    const search=page.getByRole('textbox',{name:'Buscar Generador *',exact:true});
    await expect(page.getByRole('option',{name:/QA Generador 1/})).toBeVisible();
    await expect(search).not.toBeFocused();
    await keyboardProof(false,'select-open-no-keyboard');
    await page.getByRole('option',{name:/QA Generador 1/}).tap();
    await expect(trigger).toContainText('QA Generador 1');
    await trigger.tap();
    await search.tap();
    await keyboardProof(true,'select-explicit-search-keyboard');
    await search.fill('QA Generador 2');
    await expect(page.getByRole('option')).toHaveCount(1);
    await page.getByRole('option',{name:/QA Generador 2/}).tap();
    await expect(trigger).toContainText('QA Generador 2');
    await keyboardProof(false,'select-chosen-keyboard-dismissed');
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
    inspectorUserId=(await login('inspector')).id;
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
      // Keep the keyboard open and require both actual visual-viewport and
      // native accessibility bounds before the real PATCH + server ACK.
      nativeButtonTap('Guardar cambios','save-field-observation'),
    ]);
    expect(saved.status()).toBe(200);
    const confirmed=await saved.json();
    await expect(page.getByText('Cambios confirmados en el servidor',{exact:true})).toBeVisible();
    await expect(page.getByRole('banner').getByLabel('Función actual')).toHaveText('Inspector');
    await nonObstructingNotices(page);
    await expect(page.getByRole('region',{name:'Avisos del sistema'}).getByRole('status')).toHaveCount(1);
    const local=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),'sitrep_inspection_draft_'+inspectorUserId+'_'+inspection.id);
    await writeFile(path.join(output,'saved-draft-acknowledgment.json'),JSON.stringify({confirmed:confirmed.data,local},null,2));
    expect(local?.observaciones).toBe('QA Android comentario conservado después de cerrar Chrome.');
    expect(local?.version).toBe(confirmed.data.version);
    await proof('saved-field-observation');
  });
  await check('process-restart-keeps-real-session-and-record',async()=>{
    assert.ok(inspection?.id);
    const stages:Array<{stage:string;at:string;url:string;tabs:string[];draft:unknown;session:unknown}>=[];
    const captureDraft=async(stage:string)=>{
      const draft=page.url().startsWith('http://127.0.0.1:4177/')
        ? await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),
          'sitrep_inspection_draft_'+inspectorUserId+'_'+inspection.id) : null;
      const session=page.url().startsWith('http://127.0.0.1:4177/')
        ? await page.evaluate(()=>(window as Window & {__sitrepQaSessionEvidence?:unknown[]}).__sitrepQaSessionEvidence||null) : null;
      stages.push({stage,at:new Date().toISOString(),url:page.url(),tabs:context.pages().map(tab=>tab.url()),draft,session});
      await writeFile(path.join(output,'restart-draft-stages.json'),JSON.stringify({stages,sessionEvidence,sessionEvidenceOverflow},null,2));
      // Native UI dumps are useful AFTER recovery succeeds/fails. Do not add
      // a slow diagnostic at the force-stop boundary or favor Chrome's flush.
      if(stage==='after-real-recovery-attempt'||stage==='reopened-record')
        await writeFile(path.join(output,'restart-'+stage+'-native.xml'),await readNativeWindow());
    };
    // Observe only the scoped QA draft; no tokens, storage injection, artificial
    // waiting for Chrome's disk commit or hidden removal of a conflict.
    await captureDraft('before-force-stop');
    await closeContext();
    await launch();
    await captureDraft('after-launch-before-navigation');
    let restoredProfile;
    try {
      [restoredProfile] = await Promise.all([
        page.waitForResponse(r=>r.url().endsWith('/api/auth/profile')&&r.request().method()==='GET'),
        page.goto('http://127.0.0.1:4177/app/inspecciones/'+inspection.id+'#acta'),
      ]);
    } finally { await captureDraft('after-real-recovery-attempt'); }
    expect(restoredProfile.status()).toBe(200);
    expect((await restoredProfile.json()).data.user.id).toBe(inspectorUserId);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.locator('#inspection-observations')).toHaveValue('QA Android comentario conservado después de cerrar Chrome.');
    await captureDraft('reopened-record');
    await expect(page.getByText('Hay un borrador anterior sin conciliar',{exact:true})).toHaveCount(0);
    await expect(page.locator('#inspection-observations')).toBeEnabled();
    await expect(page.getByRole('button',{name:'Saltar introducción',exact:true})).toHaveCount(0);
    await proof('restarted-inspector-record');
  });
  await check('unsent-field-comment-survives-process-stop-without-false-server-ack',async()=>{
    assert.ok(inspection?.id);
    const unsent='QA Android: comentario local sin confirmación del servidor.';
    const key='sitrep_inspection_draft_'+inspectorUserId+'_'+inspection.id;
    deliberateOfflineContexts.add(context);
    await context.setOffline(true);
    try{
      await page.locator('#inspection-observations').fill(unsent);
      await expect(page.locator('#inspection-observations')).toHaveValue(unsent);
      // Await the application's observable local persistence, not an artificial
      // delay for Chrome to commit its profile to disk. No storage injection.
      await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.observaciones,key)).toBe(unsent);
      // A localStorage renderer value is not a durable ACK. Require the actual
      // application save status after its strict transaction, without injecting
      // storage or adding a delay to favor Chrome's profile flush.
      await expect(page.getByTestId('inspection-field-save-bar')).toContainText('Solo en este dispositivo');
      await expect(page.getByText('Cambios confirmados en el servidor',{exact:true})).toHaveCount(0);
      await proof('unsent-field-comment-local');
    }catch(error){
      // Capture the live app before force-stop: a dead browser cannot explain
      // why a local draft was absent. Read only this synthetic case's drafts,
      // never credentials or other users' storage.
      const state=await page.evaluate(({key,id})=>({
        expectedKey:key,url:location.href,online:navigator.onLine,
        visible:document.visibilityState,
        field:{value:(document.querySelector('#inspection-observations') as HTMLTextAreaElement)?.value,
          disabled:(document.querySelector('#inspection-observations') as HTMLTextAreaElement)?.disabled},
        draftKeys:Object.keys(localStorage).filter(k=>k.startsWith('sitrep_inspection_draft_')&&k.endsWith('_'+id))
          .map(k=>({key:k,draft:JSON.parse(localStorage.getItem(k)||'null')})),
        feedback:Array.from(document.querySelectorAll('[role="alert"], [data-testid="inspection-field-save-bar"]')).map(el=>el.textContent),
      }),{key,id:inspection.id});
      await writeFile(path.join(output,'unsent-field-live-failure.json'),JSON.stringify(state,null,2));
      await proof('unsent-field-live-failure');
      throw error;
    }finally{await closeContext();}
    await launch();
    // Reopening online intentionally synchronizes a recovered dirty draft.
    // Observe its real PATCH before navigation; do not require a redundant
    // manual save after the existing reconnect workflow already confirmed it.
    const synchronized=page.waitForResponse(r=>r.url().endsWith('/api/inspecciones/'+inspection.id+'/borrador')&&r.request().method()==='PATCH');
    const [server, restoredProfile]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/inspecciones/'+inspection.id)&&r.request().method()==='GET'&&r.status()===200),
      page.waitForResponse(r=>r.url().endsWith('/api/auth/profile')&&r.request().method()==='GET'),
      page.goto('http://127.0.0.1:4177/app/inspecciones/'+inspection.id+'#acta'),
    ]);
    expect(restoredProfile.status()).toBe(200);
    expect((await restoredProfile.json()).data.user.id).toBe(inspectorUserId);
    const serverCopy=(await server.json()).data;
    expect(serverCopy.observaciones).toBe('QA Android comentario conservado después de cerrar Chrome.');
    await expect(page.locator('#inspection-observations')).toHaveValue(unsent);
    await expect(page.locator('#inspection-observations')).toBeEnabled();
    await expect(page.getByText('Cambios confirmados en el servidor',{exact:true})).toHaveCount(0);
    const local=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
    await writeFile(path.join(output,'unsent-field-recovery.json'),JSON.stringify({server:serverCopy.observaciones,local:local?.observaciones},null,2));
    await proof('unsent-field-comment-recovered');
    const saved=await synchronized;
    expect(saved.status()).toBe(200);
    const acknowledgment=(await saved.json()).data;
    expect(acknowledgment.observaciones).toBe(unsent);
    await expect(page.getByTestId('inspection-field-save-bar')).toContainText('Guardado en SITREP');
    await expect(page.getByRole('button',{name:'Guardar cambios',exact:true})).toBeDisabled();
    await writeFile(path.join(output,'unsent-field-sync-acknowledgment.json'),JSON.stringify({
      status:saved.status(),version:acknowledgment.version,observaciones:acknowledgment.observaciones,
    },null,2));
    await proof('unsent-field-comment-server-confirmed');
  });
  await check('inspection-indexes-and-current-control-are-closable-on-Android',async()=>{
    await page.goto('http://127.0.0.1:4177/app/inspecciones');
    await page.getByRole('button',{name:'Nueva inspección',exact:true}).tap();
    const dialog=page.getByRole('dialog',{name:'Nueva inspección',exact:true});
    await dialog.getByRole('combobox',{name:'Actor inspeccionado',exact:true}).selectOption({label:'QA Generador 1'});
    const [response]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/inspecciones')&&r.request().method()==='POST'),
      dialog.getByRole('button',{name:'Crear expediente',exact:true}).tap(),
    ]);
    expect(response.status()).toBe(201);
    const created=(await response.json()).data;
    const [started]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/inspecciones/'+created.id+'/estado')&&r.request().method()==='POST'),
      page.getByRole('button',{name:'Iniciar visita',exact:true}).tap(),
    ]);
    expect(started.status()).toBe(200);
    await page.getByRole('navigation',{name:'Secciones del expediente'}).getByRole('link',{name:'Controles',exact:true}).tap();
    await page.getByRole('link',{name:'En campo',exact:true}).tap();
    await page.getByRole('button',{name:/^Ir a un control:/}).tap();
    await expect(page.getByRole('searchbox',{name:'Buscar control',exact:true})).not.toBeFocused();
    await keyboardProof(false,'field-index-open-no-keyboard');
    const field=created.items[0];
    await page.getByRole('navigation',{name:'Índice de controles',exact:true}).getByRole('button').filter({hasText:field.etiqueta}).tap();
    const row=page.locator('[id="control-'+field.id+'"]');
    const header=row.locator('button[aria-controls]').first();
    const observation=row.getByRole('textbox',{name:'Observación: '+field.etiqueta,exact:true});
    await observation.fill('QA nota Android preservada al cerrar');
    await expect.poll(() => page.locator('[data-inspection-scroll]').evaluate(element => element.getBoundingClientRect().height),
      { message: 'Keyboard editing must retain a real visible scroll surface, never height zero' }).toBeGreaterThan(0);
    // The Android visual viewport is panned while the field keyboard is open.
    // Run121's CDP touch hit other elements although the OS screenshot showed
    // this action. Require fresh native bounds and a real OS tap, as for Save;
    // retain the keyboard, draft and actual collapsed-state expectations.
    await nativeButtonTap('Volver al control actual','return-to-current-control');
    await expect(page.getByRole('button',{name:new RegExp('^Ver los '+created.items.length+' controles$')})).toHaveAttribute('aria-expanded','false');
    await header.tap();
    await expect(header).toHaveAttribute('aria-expanded','false');
    await expect(observation).toHaveCount(0);
    await expect(page.locator('#checklist button[aria-controls^="control-detail-"][aria-expanded="true"]')).toHaveCount(0);
    await proof('field-current-control-closed');
    await header.tap();
    await expect(observation).toHaveValue('QA nota Android preservada al cerrar');
    const [saved]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/inspecciones/'+created.id+'/borrador')&&r.request().method()==='PATCH'),
      nativeButtonTap('Guardar cambios','collapse-field-save'),
    ]);
    expect(saved.status()).toBe(200);
    expect((await saved.json()).data.items.find((item:{id:string})=>item.id===field.id).observacion).toBe('QA nota Android preservada al cerrar');
    await page.getByRole('link',{name:'Datos declarados',exact:true}).tap();
    await page.getByRole('button',{name:/^Ir a un dato declarado:/}).tap();
    const declaredSearch=page.getByRole('searchbox',{name:'Buscar dato declarado',exact:true});
    await expect(declaredSearch).not.toBeFocused();
    await keyboardProof(false,'declared-index-open-no-keyboard');
    const index=page.getByRole('navigation',{name:'Datos declarados',exact:true});
    await expect(index.getByRole('button').first()).toBeVisible();
    await declaredSearch.tap();
    await keyboardProof(true,'declared-explicit-search-keyboard');
    const label=(await index.getByRole('button').first().locator('span.block.text-sm').textContent())!;
    await declaredSearch.fill(label);
    await nativeButtonTap(label,'declared-option-with-keyboard',index.getByRole('button').first());
    await expect(page.getByRole('textbox',{name:'Valor verificado: '+label,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Ocultar detalle',exact:true}).tap();
    await expect(page.getByRole('textbox',{name:'Valor verificado: '+label,exact:true})).toHaveCount(0);
    await keyboardProof(false,'declared-choice-keyboard-dismissed');
  });
  await check('logout-removes-access-to-protected-route',async()=>{
    await logout();
    await page.goto('http://127.0.0.1:4177/app/inspecciones/'+inspection.id);
    await expect(page).toHaveURL(/\/app\/login$/);await proof('logged-out');
  });
  const gpsResponses:Array<{status:number;latitude:number;longitude:number}>=[];
  await check('carrier-gps-sends-observed-location-to-real-api',async()=>{
    // A separate person's trip is an independent Chrome lifecycle. Always
    // restart here, not conditionally to conceal a failed inspector check.
    await closeContext();await launch();
    await page.goto('http://127.0.0.1:4177/app/dashboard');
    const email=page.getByLabel('Correo electrónico o CUIT');
    await expect.poll(async()=>await email.isVisible()||await page.getByRole('banner').isVisible()).toBe(true);
    if(!await email.isVisible())await logout();
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
      deliberateOfflineContexts.add(context);
      await context.setOffline(true);
      await context.setGeolocation({latitude:-32.891,longitude:-68.841});
      await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]').length,key),{timeout:45000}).toBeGreaterThan(0);
      await expect(page.getByText('Guardando local',{exact:true}).first()).toBeVisible();
      await proof('gps-offline-protected');
    }finally{await context.setOffline(false);deliberateOfflineContexts.delete(context);}
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
    const back=page.getByRole('button',{name:'Volver',exact:true});
    await readableWholeWords(back);
    await expect(back).toHaveCSS('background-color','rgb(255, 255, 255)');
    await expect(back.locator('span').last()).toHaveCSS('color','rgb(18, 26, 38)');
    // Read-only diagnostic, no reconnect/retry: QA92 lost its ADB transport
    // during this capture. A later PASS must not erase that incomplete run.
    await writeFile(path.join(output,'scanner-adb-before-capture.txt'),
      execFileSync('adb',['devices','-l'],{encoding:'utf8',timeout:5000}));
    await proof('scanner-without-hardware');
    await back.tap();
    await expect(page).not.toHaveURL(/escaner-qr$/);
  });
  await check('native-support-report-and-detail-on-actual-Android',async()=>{
    await page.goto('http://127.0.0.1:4177/app/soporte');
    await expect(page.getByRole('heading',{level:2,name:'Soporte',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Reportar problema',exact:true}).last().tap();
    const dialog=page.getByRole('dialog',{name:'Reportar un problema',exact:true});
    await dialog.getByLabel('Asunto',{exact:true}).fill('QA soporte desde Android real emulado');
    await dialog.getByLabel('¿Qué intentabas hacer y qué ocurrió?',{exact:true}).fill('QA prueba sintética del formulario y entrega interna. Sin mensajes externos.');
    const creating=page.waitForResponse(response=>response.url().endsWith('/api/soporte')&&response.request().method()==='POST');
    await dialog.getByRole('button',{name:'Enviar ticket',exact:true}).tap();
    const response=await creating;expect(response.status()).toBe(201);
    const ticket=(await response.json()).data;
    await expect(page).toHaveURL('http://127.0.0.1:4177/app/soporte/'+ticket.id);
    await expect(page.getByText(ticket.referencia,{exact:true})).toBeVisible();
    await expect(page.getByText('QA prueba sintética del formulario y entrega interna. Sin mensajes externos.',{exact:true})).toBeVisible();
    await proof('support-actual-android');
  });
  await check('javascript-health',async()=>{
    await expect(page).toHaveTitle(/SITREP/i);
    assert.ok(results.some(result=>result.name==='real-os-and-admin-session'&&result.status==='PASS'), 'A real authenticated session must have run');
    await verifyManifestIcon();
    // No blanket icon ignore: require its decoded immutable bytes before/after,
    // plus a recorded deliberately offline context at the exact message time.
    expect(consoleObservations.filter(event=>!expectedOfflineConsole(event,iconProofs))).toEqual([]);
    expect(runtimeErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
    expect(browserLifecycle.filter(event=>!event.expected)).toEqual([]);
  });
}finally{
  try{
    await saveResults(results.length===16);
    await closeContext();
    await driverStep('close-QA-device',()=>device.close(),10000);
  }finally{await stopSystemLog();}
}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
