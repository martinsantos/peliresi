import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {isolatedMapTiles,prefix} from './helpers';

test('coordinates an in-flight fleet point and a delivery in another tab',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-private.json'),'utf8'));
  const loads=fixture.cases[info.project.name],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,deviceScaleFactor:1,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',permissions:['geolocation'],geolocation:{latitude:-33.2,longitude:-68.9}});
  let release!:()=>void,entered!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
  let fail=true,deliveries=0,otherPoints=0,points=0;const refs:string[]=[];
  context.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/manifiestos/${loads.a.id}/confirmar-entrega-idempotente`))deliveries++;});
  context.on('response',response=>{if(response.request().method()!=='POST'||response.status()!==200)return;
    if(response.url().endsWith(`/manifiestos/${loads.a.id}/ubicacion-idempotente`))points++;
    if(response.url().endsWith(`/manifiestos/${loads.b.id}/ubicacion-idempotente`))otherPoints++;});
  await context.route(`**/api/manifiestos/${loads.a.id}/ubicacion-idempotente`,async route=>{
    refs.push(route.request().postDataJSON().puntoId);
    if(fail){entered();await gate;await route.abort('failed');}else await route.continue();
  });
  try{
    const fleet=await context.newPage();await isolatedMapTiles(fleet,info);
    await fleet.goto(mp+'/login');await fleet.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email);
    await fleet.getByLabel('Contraseña',{exact:true}).fill(fixture.password);await fleet.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(fleet).not.toHaveURL(/\/login$/);const skip=fleet.getByRole('button',{name:'Saltar introducción',exact:true});if(await skip.isVisible())await skip.click();
    await fleet.goto(mp+'/transporte/cargas');await fleet.getByRole('searchbox',{name:'Número de manifiesto'}).fill(loads.prefix);
    await fleet.getByRole('button',{name:'Buscar',exact:true}).click();
    for(const load of [loads.a,loads.b])await fleet.getByRole('checkbox',{name:`Llevo ${load.numero} en este móvil`}).check();
    await fleet.getByRole('button',{name:'Iniciar GPS',exact:true}).click();await started;

    const other=await context.newPage();await other.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,
      value:{watchPosition(){return 1;},getCurrentPosition(){},clearWatch(){}}}));
    await isolatedMapTiles(other,info);await other.goto(`${mp}/transporte/viaje/${loads.a.id}`);
    await other.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
    await other.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();
    const dialog=other.getByRole('dialog',{name:'Confirmar Entrega?'});
    await expect(dialog.getByRole('alert')).toContainText('otra pestaña');expect(deliveries).toBe(0);
    await dialog.screenshot({path:info.outputPath('gps-other-tab-in-flight.png')});

    release();await expect(fleet.getByRole('button',{name:`Reintentar envío GPS de ${loads.a.numero}`})).toBeVisible();
    await expect.poll(()=>otherPoints).toBe(1);
    await other.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('GPS de varias cargas sin confirmar');expect(deliveries).toBe(0);
    await other.close();fail=false;
    await fleet.getByRole('button',{name:`Reintentar envío GPS de ${loads.a.numero}`}).click();await expect.poll(()=>points).toBe(1);
    expect(new Set(refs).size).toBe(1);
    await fleet.getByRole('button',{name:`Entregar ${loads.a.numero}`}).click();
    await fleet.getByRole('dialog',{name:'Confirmar entrega'}).getByRole('button',{name:'Confirmar entrega de esta carga'}).click();
    await expect.poll(()=>deliveries).toBe(1);
  }finally{release();await context.close();}
});
