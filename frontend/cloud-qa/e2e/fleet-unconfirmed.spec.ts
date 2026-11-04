import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isolatedMapTiles, prefix } from './helpers';

test('one failed fleet GPS upload does not silently pass delivery', async ({ browser }, info) => {
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-private.json'),'utf8'));
  const loads=fixture.cases[info.project.name], baseline=process.env.QA_FLEET_UNCONFIRMED_BASELINE==='true';
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',deviceScaleFactor:1,
    timezoneId:'America/Argentina/Mendoza',permissions:['geolocation'],geolocation:{latitude:-33.2,longitude:-68.9}});
  const page=await context.newPage(), errors:string[]=[], references:string[]=[];
  let failPoint=true, deliveries=0, receivedB=0, receivedA=0;
  page.setDefaultTimeout(20000); page.on('pageerror',error=>errors.push(error.message)); await isolatedMapTiles(page,info);
  await page.addInitScript(()=>localStorage.setItem('sitrep_onboarding_TRANSPORTISTA','true'));
  await page.route(`**/api/manifiestos/${loads.a.id}/ubicacion-idempotente`,async route=>{
    const body=route.request().postDataJSON(); references.push(body.puntoId);
    if(failPoint)await route.abort('failed');else await route.continue();
  });
  page.on('response',response=>{
    if(response.request().method()!=='POST'||response.status()!==200)return;
    if(response.url().endsWith(`/manifiestos/${loads.a.id}/ubicacion-idempotente`))receivedA++;
    if(response.url().endsWith(`/manifiestos/${loads.b.id}/ubicacion-idempotente`))receivedB++;
    if(response.url().endsWith(`/manifiestos/${loads.a.id}/confirmar-entrega-idempotente`))deliveries++;
  });
  try{
    const mp=prefix(info);
    await page.goto(mp+'/login');
    await page.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email);
    await page.getByLabel('Contraseña',{exact:true}).fill(fixture.password);
    await page.getByRole('button',{name:'Ingresar',exact:true}).click(); await expect(page).not.toHaveURL(/\/login$/);
    const skip=page.getByRole('button',{name:'Saltar introducción',exact:true});if(await skip.isVisible())await skip.click();
    await page.goto(mp+'/transporte/cargas');
    await page.getByRole('searchbox',{name:'Número de manifiesto'}).fill(loads.prefix);
    await page.getByRole('button',{name:'Buscar',exact:true}).click();
    for(const load of [loads.a,loads.b])await page.getByRole('checkbox',{name:`Llevo ${load.numero} en este móvil`}).check();
    await page.getByRole('button',{name:'Iniciar GPS',exact:true}).click();
    await expect(page.getByRole('button',{name:`Reintentar envío GPS de ${loads.a.numero}`})).toBeVisible();
    await expect.poll(()=>receivedB).toBe(1);
    await page.getByRole('button',{name:`Entregar ${loads.a.numero}`}).click();
    const dialog=page.getByRole('dialog',{name:'Confirmar entrega'});
    await dialog.getByRole('button',{name:'Confirmar entrega de esta carga'}).click();
    if(baseline){
      await expect.poll(()=>deliveries).toBe(1);
    }else{
      await expect(dialog.getByRole('alert')).toContainText(/ubicación pendiente sin confirmar/i);
      expect(deliveries).toBe(0);
      await dialog.screenshot({path:info.outputPath('pending-location-dialog.png')});
      await dialog.getByRole('button',{name:'Volver'}).click();
      await expect(page.getByRole('button',{name:`Reintentar envío GPS de ${loads.a.numero}`})).toBeVisible();
      failPoint=false;
      await page.getByRole('button',{name:`Reintentar envío GPS de ${loads.a.numero}`}).click();
      await expect.poll(()=>receivedA).toBe(1);
      expect(references.length).toBeGreaterThanOrEqual(2);
      expect(new Set(references).size).toBe(1);
      await page.getByRole('button',{name:`Entregar ${loads.a.numero}`}).click();
      await dialog.getByRole('button',{name:'Confirmar entrega de esta carga'}).click();
      await expect.poll(()=>deliveries).toBe(1);
      await expect(page.getByRole('region',{name:'Cargas marcadas'})).toContainText(loads.b.numero);
    }
    expect(receivedB).toBe(1);expect(errors).toEqual([]);
  }finally{await context.close();}
});
