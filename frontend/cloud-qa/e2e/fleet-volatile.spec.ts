import {expect,test} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {isolatedMapTiles,prefix} from './helpers';

test('an unsaved fleet observation cannot be bypassed in another tab',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-private.json'),'utf8'));
  const loads=fixture.cases[info.project.name],mp=prefix(info),baseline=process.env.QA_FLEET_VOLATILE_BASELINE==='true';
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,deviceScaleFactor:1,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',permissions:['geolocation'],geolocation:{latitude:-33.2,longitude:-68.9}});
  let deliveries=0,otherPoints=0,points=0;const pageErrors:string[]=[],consoleMessages:string[]=[];
  context.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith(`/manifiestos/${loads.a.id}/confirmar-entrega-idempotente`))deliveries++;});
  context.on('response',response=>{if(response.request().method()!=='POST'||response.status()!==200)return;
    if(response.url().endsWith(`/manifiestos/${loads.a.id}/ubicacion-idempotente`))points++;
    if(response.url().endsWith(`/manifiestos/${loads.b.id}/ubicacion-idempotente`))otherPoints++;});
  try{
    const fleet=await context.newPage();fleet.on('pageerror',error=>pageErrors.push(error.message));
    fleet.on('console',message=>{if(['error','warning'].includes(message.type()))consoleMessages.push(message.type()+': '+message.text());});
    await isolatedMapTiles(fleet,info);
    await fleet.goto(mp+'/login');await fleet.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email);
    await fleet.getByLabel('Contraseña',{exact:true}).fill(fixture.password);await fleet.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(fleet).not.toHaveURL(/\/login$/);const skip=fleet.getByRole('button',{name:'Saltar introducción',exact:true});if(await skip.isVisible())await skip.click();
    await fleet.addInitScript(({id})=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(this===localStorage&&sessionStorage.getItem('qa-fleet-storage-ok')!=='yes'&&key.startsWith('sitrep_fleet_gps_v1:')&&key.includes(encodeURIComponent('MANIFIESTO:'+id))){
          throw new DOMException('Simulated storage failure','QuotaExceededError');
        }
        return original.call(this,key,value);
      };
    },{id:loads.a.id});
    await fleet.goto(mp+'/transporte/cargas');await fleet.getByRole('searchbox',{name:'Número de manifiesto'}).fill(loads.prefix);
    await fleet.getByRole('button',{name:'Buscar',exact:true}).click();
    for(const load of [loads.a,loads.b])await fleet.getByRole('checkbox',{name:`Llevo ${load.numero} en este móvil`}).check();
    await fleet.getByRole('button',{name:'Iniciar GPS',exact:true}).click();
    await expect(fleet).toHaveTitle(/SITREP/i);
    await expect(fleet).toHaveURL(new RegExp('/transporte/cargas'));
    await expect(fleet.locator('vite-error-overlay')).toHaveCount(0);
    await expect(fleet.getByRole('button',{name:`Reintentar envío GPS de ${loads.a.numero}`})).toBeVisible();
    await expect.poll(()=>otherPoints).toBe(1);expect(points).toBe(0);
    await fleet.screenshot({path:info.outputPath('fleet-storage-failed.png')});
    const other=await context.newPage();other.on('pageerror',error=>pageErrors.push(error.message));
    other.on('console',message=>{if(['error','warning'].includes(message.type()))consoleMessages.push(message.type()+': '+message.text());});
    await other.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,
      value:{watchPosition(){return 1;},getCurrentPosition(){},clearWatch(){}}}));
    await isolatedMapTiles(other,info);await other.goto(`${mp}/transporte/viaje/${loads.a.id}`);
    await other.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
    await other.getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();
    if(baseline){await expect.poll(()=>deliveries).toBe(1);expect(points).toBe(0);}
    else{
      const dialog=other.getByRole('dialog',{name:'Confirmar Entrega?'});
      await expect(dialog.getByRole('alert')).toContainText('otra pestaña');expect(deliveries).toBe(0);
      await dialog.screenshot({path:info.outputPath('delivery-blocked-other-tab.png')});
      await fleet.getByRole('link',{name:'Mis viajes',exact:true}).click();
      await expect(fleet).toHaveURL(/\/transporte\/perfil$/);
      await expect(fleet.getByRole('button',{name:'GPS de mis viajes',exact:true})).toBeVisible();
      await expect(fleet.getByText('Ubicación GPS sin guardar')).toBeVisible();
      await expect(fleet.getByText(/No cierres ni recargues SITREP/)).toBeVisible();
      await expect(fleet.getByText('Cargando viajes…')).toHaveCount(0,{timeout:15000});
      await fleet.screenshot({path:info.outputPath('fleet-warning-after-navigation.png')});
      const prevented=await fleet.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
      expect(prevented).toBe(true);
      await fleet.evaluate(()=>sessionStorage.setItem('qa-fleet-storage-ok','yes'));
      await fleet.getByRole('button',{name:'GPS de mis viajes',exact:true}).click();
      await fleet.getByRole('searchbox',{name:'Número de manifiesto'}).fill(loads.prefix);
      await fleet.getByRole('button',{name:'Buscar',exact:true}).click();
      await fleet.getByRole('checkbox',{name:`Llevo ${loads.a.numero} en este móvil`}).check();
      await fleet.getByRole('button',{name:'Iniciar GPS',exact:true}).click();await expect.poll(()=>points).toBe(1);
      await other.close();
      await fleet.getByRole('button',{name:`Entregar ${loads.a.numero}`}).click();
      await fleet.getByRole('dialog',{name:'Confirmar entrega'}).getByRole('button',{name:'Confirmar entrega de esta carga'}).click();
      await expect.poll(()=>deliveries).toBe(1);
    }
    writeFileSync(info.outputPath('console.json'),JSON.stringify({pageErrors,consoleMessages},null,2));
    expect(pageErrors).toEqual([]);
  }finally{await context.close();}
});
