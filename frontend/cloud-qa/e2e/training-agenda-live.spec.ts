import {test,expect,devices,type Page,type TestInfo,type Locator} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {directTrainingLogin} from '../direct-training-login';
import {prefix,readablePageHeading} from './helpers';
async function dismissLive(page:Page){if(await page.getByRole('dialog').count())return;const close=page.getByRole('button',{name:'Cerrar aviso en vivo',exact:true});for(let i=0;i<50&&await close.isVisible();i++)await close.click();}
async function navigation(page: Page, info: TestInfo, route: string) {
  await dismissLive(page);
  const target = page.locator(`a[href="${prefix(info)}${route}"]:visible`).first();
  const box=await target.count()?await target.boundingBox():null;
  if (!box || box.x < 0 || box.x + box.width > page.viewportSize()!.width) await page.getByRole('button', {name:/^Abrir men[uú]$/}).click();
  await expect(target).toBeVisible(); await target.click();
  await expect(page).toHaveURL(new RegExp(prefix(info) + route + '$'));
}
async function openManifest(page: Page, info: TestInfo, number: string) {
  await navigation(page, info, '/manifiestos');
  await page.getByRole('textbox', {name:'Buscar manifiestos',exact:true}).fill(number);
  const row = page.getByRole('link', {name:number,exact:true});
  await expect(row).toBeVisible(); await row.click();
}
async function choose(page:Page,name:string,value:RegExp){
  await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('option',{name:value}).click();
}
async function proof(page:Page,info:TestInfo,name:string){
  await expect(page).toHaveTitle(/SITREP/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByText('Capacitación · sin validez oficial',{exact:false}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await readablePageHeading(page);
  const contrasts=await page.locator('button[data-ui-button="primary"]:enabled:visible').evaluateAll(buttons=>{
    const luminance=(color:string)=>{const v=(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
    return buttons.map(button=>{const bg=luminance(getComputedStyle(button).backgroundColor),fg=luminance(getComputedStyle(button.querySelector('span')||button).color);return {text:button.textContent,ratio:(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)};});
  });
  for(const item of contrasts)expect(item.ratio,'Button contrast: '+item.text).toBeGreaterThanOrEqual(4.5);

  await page.screenshot({path:info.outputPath(name+'.png'),fullPage:true,animations:'disabled'});
}
async function post(page:Page,suffix:string,action:()=>Promise<unknown>,status=200){
  await dismissLive(page);
  const result=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='POST');
  await action();const response=await result;expect(response.status(),suffix).toBe(status);
  expect(response.headers()['x-sitrep-training']).toBe('true');return {...await response.json(),__command:response.request().postDataJSON()};
}

async function draw(page:Page,area:Locator){
 const canvas=area.locator('canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
 await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();
 for(const [x,y]of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});
 await page.mouse.up();await area.getByRole('button',{name:'Usar firma',exact:true}).click();
}
async function createProposal(page:Page,info:TestInfo,role:string,team:number,futureDays=1){
 await navigation(page,info,'/manifiestos');
 await page.getByRole('button',{name:'Nuevo Manifiesto',exact:true}).click();
 if(role!=='generador')await choose(page,'Generador *',new RegExp('^CAP · Generador '+team));
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 await choose(page,'Tipo de Residuo *',/^Y-CAP/);
 await page.getByLabel('Cantidad *',{exact:true}).fill('10');
 await page.getByRole('button',{name:'Siguiente',exact:true}).click();
 if(role!=='transportista')await choose(page,'Transportista *',new RegExp('^CAP · Transporte '+team));
 await choose(page,'Vehículo (opcional)',new RegExp('^CAP00'+team));
 await choose(page,'Chofer (opcional)',new RegExp('^Chofer ficticio '+team));
 if(role!=='operador')await choose(page,'Operador / Destino *',new RegExp('^CAP · Operador '+team));
 const future=new Date(Date.now()+futureDays*86400000).toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Mendoza'});
 await page.getByLabel('Fecha estimada de retiro',{exact:true}).fill(future);
 await proof(page,info,'creation-'+role);
 const created=await post(page,'/api/manifiestos',()=>page.getByRole('button',{name:'Crear Manifiesto',exact:true}).click(),201);
 expect(created.data.manifiesto.estado).toBe('PENDIENTE_APROBACION');
 return created.data.manifiesto;
}

for(const role of ['operador','generador','transportista','admin'])test('new proposal appears first for creator and live counterpart: '+role,async({browser},info)=>{
 expect(process.env.QA_TRAINING_PUBLISHED).not.toBe('true');
 const scope={manifests:new Set<string>(),eventuals:new Set<string>()};
 const a=await browser.newContext({...devices['Pixel 7'],viewport:{width:360,height:800},baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
 const b=await browser.newContext({...devices['Pixel 7'],viewport:{width:360,height:800},baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
 const page=await a.newPage(),other=await b.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));other.on('pageerror',e=>errors.push(e.message));
 try{
 await directTrainingLogin(page,info,role,scope);const home=page.url();
 await directTrainingLogin(other,info,role==='operador'?'transportista':'operador',scope);
 await expect(other.getByRole('region',{name:'Agenda de manifiestos'})).toBeVisible();
 const m=await createProposal(page,info,role,1,1);
 await expect(page).toHaveURL(new RegExp('/manifiestos/'+m.id+'$'));
 if(role!=='admin'){
  const region=page.getByRole('region',{name:'Aprobaciones de las partes'});await expect(region).toBeVisible();
  if(role==='generador'){
   await region.getByRole('button',{name:'Firmar Manifiesto',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Firma del manifiesto',exact:true});await draw(page,dialog);
   await post(page,'/'+m.id+'/firmar',()=>dialog.getByRole('button',{name:'Confirmar y Firmar',exact:true}).click());
  }else await post(page,'/'+m.id+'/aprobar-parte',()=>region.getByRole('button',{name:role==='operador'?'Aprobar como operador':'Aprobar como transporte',exact:true}).click());
 }
 await page.goto(home);
 const own=page.getByRole('region',{name:'Agenda de manifiestos'}),live=other.getByRole('region',{name:'Agenda de manifiestos'});
 await expect(own.locator('[data-agenda-row]').first()).toContainText(m.numero,{timeout:12000});
 await expect(own.locator('[data-agenda-row]').first()).toContainText('En espera');
 // The counterpart stays on its already-open homepage: no refresh or navigation.
 await expect(live.locator('[data-agenda-row]').first()).toContainText(m.numero,{timeout:12000});
 await expect(live.locator('[data-agenda-row]').first()).toContainText('Te toca aprobar');
 expect(await live.locator('[data-agenda-row]').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('agenda-row-enter');
 await own.getByRole('button',{name:'En espera',exact:true}).click();await expect(own.locator('[data-agenda-row]').first()).toContainText(m.numero);
 await other.emulateMedia({reducedMotion:'reduce'});expect(await live.locator('[data-agenda-row]').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 await dismissLive(other);await page.screenshot({path:info.outputPath('creator-waiting.png')});await other.screenshot({path:info.outputPath('counterpart-live.png')});
 expect(errors).toEqual([]);writeFileSync(info.outputPath('created-case.json'),JSON.stringify({id:m.id,numero:m.numero,creator:role,surface:info.project.name,state:m.estado,liveWithoutReload:true}));
 }finally{await a.close();await b.close();}
});
