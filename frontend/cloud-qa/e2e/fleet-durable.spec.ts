import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isolatedMapTiles, prefix } from './helpers';

const fixture=()=>JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-durable-private.json'),'utf8'));
async function login(page:Page, data:any, mp:string) {
  await page.goto(mp+'/login');
  await page.getByLabel('Correo electrónico o CUIT').fill(data.users.origin.email);
  await page.getByLabel('Contraseña',{exact:true}).fill(data.password);
  await page.getByRole('button',{name:'Ingresar',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);
  const skip=page.getByRole('button',{name:'Saltar introducción',exact:true});if(await skip.isVisible())await skip.click();
}
async function choose(page:Page,mp:string,prefixNumber:string,loads:{numero:string}[]) {
  await page.goto(mp+'/transporte/cargas');
  await page.getByRole('searchbox',{name:'Número de manifiesto'}).fill(prefixNumber);
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  for(const load of loads)await page.getByRole('checkbox',{name:`Llevo ${load.numero} en este móvil`}).check();
  await page.getByRole('button',{name:'Iniciar GPS',exact:true}).click();
}
async function quiet(page:Page){await page.addInitScript(()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(){return 1;},getCurrentPosition(){},clearWatch(){}}});
});}
async function pending(page:Page,id:string){return page.evaluate(manifestId=>Object.entries(localStorage)
  .filter(([key])=>key.startsWith('sitrep_fleet_gps_v1:'))
  .map(([key,raw])=>({key,value:JSON.parse(raw)}))
  .filter(entry=>JSON.parse(entry.value.targetKey)[1]==='MANIFIESTO:'+manifestId),id);}
async function openContext(browser:any,info:any):Promise<BrowserContext>{return browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
  isMobile:info.project.name==='app',hasTouch:info.project.name==='app',deviceScaleFactor:1,
  timezoneId:'America/Argentina/Mendoza',permissions:['geolocation'],geolocation:{latitude:-33.2,longitude:-68.9}});}

test('recovers an unconfirmed fleet point after closing the page and blocks another delivery screen',async({browser},info)=>{
  const data=fixture(),loads=data.cases[info.project.name],mp=prefix(info),context=await openContext(browser,info);
  let fail=true,deliveries=0,otherPoints=0,points=0;const refs:string[]=[];
  context.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/manifiestos/${loads.a.id}/confirmar-entrega-idempotente`))deliveries++;});
  context.on('response',response=>{if(response.request().method()!=='POST'||response.status()!==200)return;
    if(response.url().endsWith(`/manifiestos/${loads.a.id}/ubicacion-idempotente`))points++;
    if(response.url().endsWith(`/manifiestos/${loads.b.id}/ubicacion-idempotente`))otherPoints++;});
  await context.route(`**/api/manifiestos/${loads.a.id}/ubicacion-idempotente`,async route=>{
    refs.push(route.request().postDataJSON().puntoId);if(fail)await route.abort('failed');else await route.continue();
  });
  try{
    const page=await context.newPage();await isolatedMapTiles(page,info);await login(page,data,mp);
    await choose(page,mp,loads.prefix,[loads.a,loads.b]);
    await expect(page.getByText('Ubicación guardada en este dispositivo. Volvé con la misma cuenta y actividad para revisarla.')).toBeVisible();
    await expect.poll(()=>otherPoints).toBe(1);
    const saved=await pending(page,loads.a.id);expect(saved).toHaveLength(1);
    expect(Object.keys(saved[0].value).sort()).toEqual(['observedAt','point','puntoId','targetKey']);
    await page.getByRole('region',{name:'Cargas marcadas'}).screenshot({path:info.outputPath('saved-location.png')});
    const reference=refs[0];
    await page.close();

    const individual=await context.newPage();await quiet(individual);await isolatedMapTiles(individual,info);
    await individual.goto(`${mp}/transporte/viaje/${loads.a.id}`);
    await individual.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
    await individual.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();
    await expect(individual.getByRole('dialog',{name:'Confirmar Entrega?'}).getByRole('alert')).toContainText('GPS de varias cargas sin confirmar');
    expect(deliveries).toBe(0);expect(await pending(individual,loads.a.id)).toHaveLength(1);
    await individual.close();

    fail=false;
    const reopened=await context.newPage();await quiet(reopened);await isolatedMapTiles(reopened,info);
    await choose(reopened,mp,loads.prefix,[loads.a]);
    await expect.poll(()=>points).toBe(1);expect(refs.every(value=>value===reference)).toBe(true);
    await expect.poll(async()=>(await pending(reopened,loads.a.id)).length).toBe(0);
    await reopened.getByRole('button',{name:`Entregar ${loads.a.numero}`}).click();
    await reopened.getByRole('dialog',{name:'Confirmar entrega'}).getByRole('button',{name:'Confirmar entrega de esta carga'}).click();
    await expect.poll(()=>deliveries).toBe(1);
    await reopened.screenshot({path:info.outputPath('recovered-delivery.png'),animations:'disabled'});
  }finally{await context.close();}
});

test('checks a lost response for an older point without sending it as a current location',async({browser},info)=>{
  const data=fixture(),loads=data.cases[info.project.name],mp=prefix(info),context=await openContext(browser,info);
  let attempts=0,receipts=0;
  context.on('response',response=>{if(response.request().method()==='GET'&&response.url().includes(`/manifiestos/${loads.stale.id}/ubicaciones/`)&&response.url().endsWith('/confirmacion')&&response.status()===200)receipts++;});
  await context.route(`**/api/manifiestos/${loads.stale.id}/ubicacion-idempotente`,async route=>{
    attempts++;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed');
  });
  try{
    const page=await context.newPage();await isolatedMapTiles(page,info);await login(page,data,mp);await choose(page,mp,loads.prefix,[loads.stale]);
    await expect(page.getByText('Ubicación guardada en este dispositivo. Volvé con la misma cuenta y actividad para revisarla.')).toBeVisible();
    const entries=await pending(page,loads.stale.id);expect(entries).toHaveLength(1);
    // Move only the synthetic browser observation into the past; the backend
    // receipt still identifies the same coordinates and retry reference.
    await page.evaluate(key=>{const value=JSON.parse(localStorage.getItem(key)!);value.observedAt-=70_000;localStorage.setItem(key,JSON.stringify(value));},entries[0].key);
    await page.close();
    const reopened=await context.newPage();await quiet(reopened);await isolatedMapTiles(reopened,info);await choose(reopened,mp,loads.prefix,[loads.stale]);
    await expect(reopened.getByText('SITREP confirmó una ubicación anterior')).toBeVisible();
    await expect.poll(()=>receipts).toBe(1);expect(attempts).toBe(1);
    await expect.poll(async()=>(await pending(reopened,loads.stale.id)).length).toBe(0);
    await reopened.screenshot({path:info.outputPath('old-receipt-confirmed.png'),animations:'disabled'});
  }finally{await context.close();}
});
