import {expect,test,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {isolatedMapTiles,prefix} from './helpers';

async function installGps(page:Page){
  await page.addInitScript(()=>{
    let watcher:PositionCallback|undefined;
    (window as any).qaRelayGps={ready:()=>!!watcher,emit:(time:number)=>watcher?.({coords:{latitude:-33.2,longitude:-68.9,accuracy:10,speed:null,heading:null,altitude:null,altitudeAccuracy:null},timestamp:time} as GeolocationPosition)};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(callback:PositionCallback){watcher=callback;return 1;},clearWatch(){watcher=undefined;}}});
  });
}

test('a lost relay response survives a page reopen without duplicating its fix',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-private.json'),'utf8'));
  const loads=fixture.cases[info.project.name],mp=prefix(info),baseline=process.env.QA_RELAY_DURABLE_BASELINE==='true';
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.name==='app'?{width:320,height:800}:info.project.use.viewport,deviceScaleFactor:1,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const external=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.name==='app'?{width:320,height:800}:info.project.use.viewport,deviceScaleFactor:1,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const fleet=await context.newPage(),relay=await external.newPage(),fleetRefs:string[]=[],relayRefs:string[]=[],errors:string[]=[];
  fleet.on('pageerror',error=>errors.push(error.message));relay.on('pageerror',error=>errors.push(error.message));
  await installGps(fleet);await installGps(relay);await isolatedMapTiles(fleet,info);await isolatedMapTiles(relay,info);
  try{
    await fleet.goto(mp+'/login');await fleet.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email);
    await fleet.getByLabel('Contraseña',{exact:true}).fill(fixture.password);await fleet.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(fleet).not.toHaveURL(/\/login$/);const skip=fleet.getByRole('button',{name:'Saltar introducción',exact:true});if(await skip.isVisible())await skip.click();
    const auth=await fleet.evaluate(()=>localStorage.getItem('sitrep_access_token'));expect(auth).toBeTruthy();
    const created=await fleet.request.post(`/api/manifiestos/${loads.a.id}/tramos`,{headers:{Authorization:'Bearer '+auth},data:{id:randomUUID(),anteriorId:null,tipo:'EXTERNO',datos:{empresa:'QA Auxilio externo'},motivo:'Relevo sintético para probar recuperación GPS'}});
    expect(created.status()).toBe(201);const {tramo,acceso}=(await created.json()).data;
    const externalUrl=`/api/seguimiento-relevo/${tramo.id}/ubicacion-idempotente`;
    await relay.route(`**${externalUrl}`,async route=>{
      relayRefs.push(route.request().postDataJSON().puntoId);const response=await route.fetch();
      if(relayRefs.length===1)await route.abort('failed');else await route.fulfill({response});
    });
    await relay.goto(`${mp}/relevo/${tramo.id}#${acceso}`);
    await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect.poll(()=>relay.evaluate(()=>(window as any).qaRelayGps.ready())).toBe(true);
    const timestamp=Date.now();await relay.evaluate(time=>(window as any).qaRelayGps.emit(time),timestamp);
    await expect(relay.getByRole('alert')).toBeVisible();expect(relayRefs).toHaveLength(1);
    await relay.reload();await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect.poll(()=>relay.evaluate(()=>(window as any).qaRelayGps.ready())).toBe(true);
    if(baseline)await relay.evaluate(time=>(window as any).qaRelayGps.emit(time),timestamp);
    await expect.poll(()=>relayRefs.length).toBe(2);
    await expect(relay.getByRole('status')).toContainText('recibida');
    if(baseline)expect(relayRefs[1]).not.toBe(relayRefs[0]);else expect(relayRefs[1]).toBe(relayRefs[0]);

    const fleetUrl=`/api/seguimiento-relevo/${loads.incoming.tramoId}/ubicacion-idempotente`;
    await fleet.route(`**${fleetUrl}`,async route=>{
      fleetRefs.push(route.request().postDataJSON().puntoId);const response=await route.fetch();
      if(fleetRefs.length===1)await route.abort('failed');else await route.fulfill({response});
    });
    const openFleet=async()=>{
      await fleet.goto(mp+'/transporte/cargas');await fleet.getByRole('searchbox',{name:'Número de manifiesto'}).fill(loads.prefix);
      await fleet.getByRole('button',{name:'Buscar',exact:true}).click();
      await fleet.getByRole('checkbox',{name:`Llevo ${loads.incoming.numero} en este móvil`}).check();
      await fleet.getByRole('button',{name:'Iniciar GPS',exact:true}).click();
    };
    await openFleet();await expect.poll(()=>fleet.evaluate(()=>(window as any).qaRelayGps.ready())).toBe(true);
    const fleetTime=Date.now();await fleet.evaluate(time=>(window as any).qaRelayGps.emit(time),fleetTime);
    await expect(fleet.getByRole('button',{name:`Reintentar envío GPS de ${loads.incoming.numero}`})).toBeVisible();expect(fleetRefs).toHaveLength(1);
    await fleet.reload();await openFleet();
    if(baseline){await expect.poll(()=>fleet.evaluate(()=>(window as any).qaRelayGps.ready())).toBe(true);await fleet.evaluate(time=>(window as any).qaRelayGps.emit(time),fleetTime);}
    await expect.poll(()=>fleetRefs.length).toBe(2);
    if(baseline)expect(fleetRefs[1]).not.toBe(fleetRefs[0]);else expect(fleetRefs[1]).toBe(fleetRefs[0]);
    expect(await relay.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await relay.screenshot({path:info.outputPath('relevo-recuperado.png')});
    expect(errors).toEqual([]);
    writeFileSync(info.outputPath('relay-ids.json'),JSON.stringify({standaloneLeg:tramo.id,fleetLeg:loads.incoming.tramoId}));
  }finally{await external.close();await context.close();}
});

test('a rotated relay authorization confirms an earlier point and continues GPS',async({browser},info)=>{
  test.skip(process.env.QA_RELAY_DURABLE_BASELINE==='true','The baseline does not yet preserve a relay point.');
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-private.json'),'utf8'));
  const loads=fixture.cases[info.project.name],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.name==='app'?{width:320,height:800}:info.project.use.viewport,serviceWorkers:'block'});
  const external=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.name==='app'?{width:320,height:800}:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const source=await context.newPage(),relay=await external.newPage(),refs:string[]=[],errors:string[]=[];
  source.on('pageerror',error=>errors.push(error.message));relay.on('pageerror',error=>errors.push(error.message));
  await relay.clock.install();await installGps(relay);await isolatedMapTiles(relay,info);
  try{
    await source.goto(mp+'/login');await source.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email);
    await source.getByLabel('Contraseña',{exact:true}).fill(fixture.password);await source.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(source).not.toHaveURL(/\/login$/);
    const auth=await source.evaluate(()=>localStorage.getItem('sitrep_access_token'));expect(auth).toBeTruthy();
    const created=await source.request.post(`/api/manifiestos/${loads.b.id}/tramos`,{headers:{Authorization:'Bearer '+auth},data:{id:randomUUID(),anteriorId:null,tipo:'EXTERNO',datos:{empresa:'QA Auxilio externo'},motivo:'Rotación sintética de acceso GPS'}});
    expect(created.status()).toBe(201);const {tramo,acceso}= (await created.json()).data;
    const route=`/api/seguimiento-relevo/${tramo.id}/ubicacion-idempotente`;
    await relay.route(`**${route}`,async request=>{refs.push(request.request().postDataJSON().puntoId);const response=await request.fetch();if(refs.length===1)await request.abort('failed');else await request.fulfill({response});});
    await relay.goto(`${mp}/relevo/${tramo.id}#${acceso}`);await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect.poll(()=>relay.evaluate(()=>(window as any).qaRelayGps.ready())).toBe(true);
    await relay.evaluate(()=>(window as any).qaRelayGps.emit(Date.now()));await expect(relay.getByRole('alert')).toBeVisible();
    expect(refs).toHaveLength(1);
    const rotated=await source.request.post(`/api/manifiestos/${loads.b.id}/tramos/${tramo.id}/acceso`,{headers:{Authorization:'Bearer '+auth},data:{revocar:false}});
    expect(rotated.status()).toBe(200);const newer=(await rotated.json()).data.acceso;
    const oldReceipt=await relay.request.get(`/api/seguimiento-relevo/${tramo.id}/ubicaciones/${refs[0]}/confirmacion`,{headers:{Authorization:'Bearer '+acceso}});
    expect(oldReceipt.status()).toBe(403);
    const oldVersion=JSON.parse(Buffer.from(acceso.split('.')[1],'base64url').toString()).jti;
    const currentReceipt=await relay.request.get(`/api/seguimiento-relevo/${tramo.id}/ubicaciones/${refs[0]}/confirmacion?version=${oldVersion}`,{headers:{Authorization:'Bearer '+newer}});
    expect(currentReceipt.status()).toBe(200);expect((await currentReceipt.json()).data.idempotencia.confirmado).toBe(true);
    await relay.goto(`${mp}/relevo/${tramo.id}#${newer}`);await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect(relay.getByRole('status')).toContainText('confirmó una ubicación anterior');expect(refs).toHaveLength(1);
    expect(await relay.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('sitrep_fleet_gps_v1:')).length)).toBe(0);
    const stored=await relay.evaluate(()=>JSON.stringify(localStorage));expect(stored).not.toContain(acceso);expect(stored).not.toContain(newer);
    await relay.clock.runFor(31_000);await relay.evaluate(()=>(window as any).qaRelayGps.emit(Date.now()));
    await expect.poll(()=>refs.length).toBe(2);expect(refs[1]).not.toBe(refs[0]);
    await expect(relay.getByRole('status')).toContainText('Ubicación recibida');
    expect(await relay.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);await relay.screenshot({path:info.outputPath('rotacion-relevo.png')});
    writeFileSync(info.outputPath('relay-rotation.json'),JSON.stringify({leg:tramo.id}));
  }finally{await external.close();await context.close();}
});

test('a not-accepted relay point is sent once after a renewed link checks its absence',async({browser},info)=>{
  test.skip(process.env.QA_RELAY_DURABLE_BASELINE==='true','The baseline does not preserve a relay point.');
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-private.json'),'utf8'));
  const loads=fixture.cases[info.project.name],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
  const external=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.name==='app'?{width:320,height:800}:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const source=await context.newPage(),relay=await external.newPage(),refs:string[]=[],errors:string[]=[];
  source.on('pageerror',error=>errors.push(error.message));relay.on('pageerror',error=>errors.push(error.message));await installGps(relay);
  try{
    await source.goto(mp+'/login');await source.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email);
    await source.getByLabel('Contraseña',{exact:true}).fill(fixture.password);await source.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(source).not.toHaveURL(/\/login$/);const auth=await source.evaluate(()=>localStorage.getItem('sitrep_access_token'));expect(auth).toBeTruthy();
    const created=await source.request.post(`/api/manifiestos/${loads.missing.id}/tramos`,{headers:{Authorization:'Bearer '+auth},data:{id:randomUUID(),anteriorId:null,tipo:'EXTERNO',datos:{empresa:'QA Auxilio externo'},motivo:'Ubicación no recibida antes de renovar acceso'}});
    expect(created.status()).toBe(201);const {tramo,acceso}=(await created.json()).data;
    await relay.route(`**/api/seguimiento-relevo/${tramo.id}/ubicacion-idempotente`,async request=>{
      refs.push(request.request().postDataJSON().puntoId);
      if(refs.length===1)await request.abort('failed');else await request.continue();
    });
    await relay.goto(`${mp}/relevo/${tramo.id}#${acceso}`);await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect.poll(()=>relay.evaluate(()=>(window as any).qaRelayGps.ready())).toBe(true);
    await relay.evaluate(()=>(window as any).qaRelayGps.emit(Date.now()));await expect(relay.getByRole('alert')).toBeVisible();expect(refs).toHaveLength(1);
    const rotated=await source.request.post(`/api/manifiestos/${loads.missing.id}/tramos/${tramo.id}/acceso`,{headers:{Authorization:'Bearer '+auth},data:{revocar:false}});
    expect(rotated.status()).toBe(200);const newer=(await rotated.json()).data.acceso;
    const oldVersion=JSON.parse(Buffer.from(acceso.split('.')[1],'base64url').toString()).jti;
    const check=await relay.request.get(`/api/seguimiento-relevo/${tramo.id}/ubicaciones/${refs[0]}/confirmacion?version=${oldVersion}`,{headers:{Authorization:'Bearer '+newer}});
    expect(check.status()).toBe(200);expect((await check.json()).data.idempotencia.confirmado).toBe(false);
    await relay.goto(`${mp}/relevo/${tramo.id}#${newer}`);await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect.poll(()=>refs.length).toBe(2);expect(refs[1]).toBe(refs[0]);await expect(relay.getByRole('status')).toContainText('Ubicación recibida');
    expect(await relay.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('sitrep_fleet_gps_v1:')).length)).toBe(0);
    expect(errors).toEqual([]);await relay.screenshot({path:info.outputPath('relevo-no-recibido.png')});
    writeFileSync(info.outputPath('relay-not-accepted.json'),JSON.stringify({leg:tramo.id}));
  }finally{await external.close();await context.close();}
});

test('an older relay fix is checked without retransmitting it as live GPS',async({browser},info)=>{
  test.skip(process.env.QA_RELAY_DURABLE_BASELINE==='true','The baseline does not yet preserve or check a relay point.');
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fleet-private.json'),'utf8'));
  const loads=fixture.cases[info.project.name],mp=prefix(info);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.name==='app'?{width:320,height:800}:info.project.use.viewport,serviceWorkers:'block'});
  const external=await browser.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.name==='app'?{width:320,height:800}:info.project.use.viewport,
    isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'block'});
  const source=await context.newPage(),relay=await external.newPage(),refs:string[]=[],errors:string[]=[];let checks=0;
  source.on('pageerror',error=>errors.push(error.message));relay.on('pageerror',error=>errors.push(error.message));
  await relay.clock.install();await installGps(relay);await isolatedMapTiles(relay,info);
  try{
    await source.goto(mp+'/login');await source.getByLabel('Correo electrónico o CUIT').fill(fixture.users.origin.email);
    await source.getByLabel('Contraseña',{exact:true}).fill(fixture.password);await source.getByRole('button',{name:'Ingresar',exact:true}).click();
    await expect(source).not.toHaveURL(/\/login$/);const auth=await source.evaluate(()=>localStorage.getItem('sitrep_access_token'));expect(auth).toBeTruthy();
    const created=await source.request.post(`/api/manifiestos/${loads.stale.id}/tramos`,{headers:{Authorization:'Bearer '+auth},data:{id:randomUUID(),anteriorId:null,tipo:'EXTERNO',datos:{empresa:'QA Auxilio externo'},motivo:'Revisión de ubicación GPS anterior'}});
    expect(created.status()).toBe(201);const {tramo,acceso}= (await created.json()).data;
    await relay.route(`**/api/seguimiento-relevo/${tramo.id}/ubicacion-idempotente`,async request=>{refs.push(request.request().postDataJSON().puntoId);await request.fetch();await request.abort('failed');});
    relay.on('request',request=>{if(request.method()==='GET'&&request.url().includes(`/seguimiento-relevo/${tramo.id}/ubicaciones/`)&&request.url().includes('/confirmacion'))checks++;});
    await relay.goto(`${mp}/relevo/${tramo.id}#${acceso}`);await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect.poll(()=>relay.evaluate(()=>(window as any).qaRelayGps.ready())).toBe(true);
    await relay.evaluate(()=>(window as any).qaRelayGps.emit(Date.now()));await expect(relay.getByRole('alert')).toBeVisible();expect(refs).toHaveLength(1);
    await relay.getByRole('button',{name:'Detener GPS',exact:true}).click();await relay.clock.runFor(70_000);
    await relay.reload();await relay.getByRole('button',{name:'Compartir ubicación',exact:true}).click();
    await expect(relay.getByRole('status')).toContainText('confirmó una ubicación anterior');
    expect(refs).toHaveLength(1);expect(checks).toBe(1);
    expect(await relay.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('sitrep_fleet_gps_v1:')).length)).toBe(0);
    expect(await relay.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);await relay.screenshot({path:info.outputPath('relevo-recepcion-anterior.png')});
    writeFileSync(info.outputPath('relay-older.json'),JSON.stringify({leg:tramo.id}));
  }finally{await external.close();await context.close();}
});
