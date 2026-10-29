import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {isolatedMapTiles,prefix} from './helpers';

test('external then registered handoffs keep custody, GPS, C3 and own history coherent',async({browser},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'handoff-private.json'),'utf8'));
  const manifest=fixture.browsers[info.project.name],mp=prefix(info),origin='http://127.0.0.1:4177';
  const errors:string[]=[];
  const options={baseURL:origin,viewport:info.project.use.viewport,deviceScaleFactor:1,isMobile:info.project.name==='app',hasTouch:info.project.name==='app',serviceWorkers:'allow' as const,timezoneId:'America/Argentina/Mendoza'};
  const sourceContext=await browser.newContext(options);
  const externalContext=await browser.newContext({...options,geolocation:{latitude:-33.12,longitude:-68.91},permissions:['geolocation']});
  const adminContext=await browser.newContext(options);
  const replacementContext=await browser.newContext({...options,geolocation:{latitude:-33.15,longitude:-68.95},permissions:['geolocation']});
  await externalContext.addInitScript(()=>{if(location.origin==='http://127.0.0.1:4177'){localStorage.setItem('sitrep_access_token','expired-old-user-session');localStorage.setItem('sitrep_refresh_token','expired-old-refresh');}});
  const source=await sourceContext.newPage(),external=await externalContext.newPage(),admin=await adminContext.newPage(),replacement=await replacementContext.newPage();
  for(const page of [source,external,admin,replacement]){page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await isolatedMapTiles(page,info);await page.addInitScript(()=>{
    for(const role of ['ADMIN','GENERADOR','TRANSPORTISTA','OPERADOR'])localStorage.setItem('sitrep_onboarding_'+role,'true');
  });}
  async function login(page:Page,role:string){
    await page.goto(mp+'/login');await page.getByLabel('Correo electrónico o CUIT').fill(fixture.users[role].email);await page.getByLabel('Contraseña',{exact:true}).fill(fixture.password);
    const login=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'Ingresar',exact:true}).click();expect((await login).status()).toBe(200);await expect(page).not.toHaveURL(/\/login$/);
    const skip=page.getByRole('button',{name:'Saltar introducción',exact:true});if(await skip.isVisible())await skip.click();
  }
  try{
    await login(source,'origin');await source.goto(mp+'/manifiestos/'+manifest.id);
    await source.getByRole('button',{name:'Registrar traspaso',exact:true}).click();
    const form=source.getByRole('form',{name:'Registrar traspaso de carga'});
    await form.getByRole('combobox',{name:'Reemplazo',exact:true}).selectOption('EXTERNO');
    await expect(form.getByLabel('Empresa',{exact:true})).toHaveAttribute('type','text');
    await form.getByLabel('Empresa',{exact:true}).fill('QA Auxilio externo sin CUIT');await form.getByLabel('Patente',{exact:true}).fill('QA AUX 123');await form.getByLabel('Chofer',{exact:true}).fill('Chofer ficticio de relevo');
    await form.getByLabel('Motivo del traspaso',{exact:true}).fill('Rotura ficticia del camión durante el ensayo');
    const created=source.waitForResponse(r=>r.url().endsWith(`/api/manifiestos/${manifest.id}/tramos`)&&r.request().method()==='POST');
    await form.getByRole('button',{name:'Confirmar traspaso',exact:true}).click();const response=await created;expect(response.status()).toBe(201);const leg=(await response.json()).data.tramo;
    const link=await source.getByLabel('Enlace GPS del reemplazo',{exact:true}).inputValue();expect(link).toContain('/relevo/'+leg.id+'#');
    await source.getByRole('button',{name:'Ocultar enlace',exact:true}).click();await expect(source.getByText('Eventual · datos declarados',{exact:true})).toBeVisible();
    await expect(source.getByRole('button',{name:'Pausar',exact:true})).toHaveCount(0);
    expect(await source.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    const legCard=source.getByRole('region',{name:'Tramos de transporte',exact:true});await legCard.evaluate(el=>el.scrollIntoView({block:'center'}));await legCard.screenshot({path:info.outputPath('original-tramos.png')});
    await external.goto(link);await expect(external.getByRole('heading',{name:'QA Auxilio externo sin CUIT',exact:true})).toBeVisible();expect(new URL(external.url()).hash).toBe('');
    const gps=external.waitForResponse(r=>r.url().endsWith(`/api/seguimiento-relevo/${leg.id}/ubicacion`)&&r.request().method()==='POST');
    await external.getByRole('button',{name:'Compartir ubicación',exact:true}).click();expect((await gps).status()).toBe(200);await expect(external.getByRole('status')).toHaveText('Ubicación recibida por SITREP');
    expect(await external.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await external.screenshot({path:info.outputPath('gps-reemplazo.png'),fullPage:true});
    await login(admin,'admin');await admin.goto(mp+'/centro-control');
    await admin.getByPlaceholder('Buscar por número o transportista...').fill(manifest.numero);
    await admin.getByRole('button',{name:'Seleccionar viaje '+manifest.numero,exact:true}).click();
    await expect(admin.getByText('Relevo 1 · eventual declarado · GPS recibido',{exact:true})).toBeVisible();await expect(admin.getByRole('list',{name:'Historial de transporte'})).toContainText('QA Auxilio externo sin CUIT');
    await admin.screenshot({path:info.outputPath('c3-relevo.png'),fullPage:true});
    await source.getByRole('button',{name:'Registrar traspaso',exact:true}).click();
    await form.getByRole('combobox',{name:'Reemplazo',exact:true}).selectOption('REGISTRADO');
    await form.getByRole('combobox',{name:'Transportista',exact:true}).selectOption(fixture.carriers.replacement.id);
    await form.getByRole('combobox',{name:'Móvil registrado',exact:true}).selectOption(fixture.vehicleId);
    await form.getByLabel('Motivo del traspaso',{exact:true}).fill('Relevo ficticio a otra empresa registrada');
    const createdRegistered=source.waitForResponse(r=>r.url().endsWith(`/api/manifiestos/${manifest.id}/tramos`)&&r.request().method()==='POST');
    await form.getByRole('button',{name:'Confirmar traspaso',exact:true}).click();const registeredResponse=await createdRegistered;expect(registeredResponse.status()).toBe(201);const registeredLeg=(await registeredResponse.json()).data.tramo;
    await external.reload();await expect(external.getByRole('alert')).toContainText('ya no está activo');
    await login(replacement,'replacement');await replacement.goto(mp+'/transporte/perfil');
    await expect(replacement.getByRole('heading',{name:'Relevos a mi cargo',exact:true})).toBeVisible();
    await replacement.getByRole('button',{name:'Compartir GPS',exact:true}).click();await expect(replacement.getByRole('heading',{name:fixture.carriers.replacement.razonSocial,exact:true})).toBeVisible();
    const registeredGps=replacement.waitForResponse(r=>r.url().endsWith(`/api/seguimiento-relevo/${registeredLeg.id}/ubicacion`)&&r.request().method()==='POST');
    await replacement.getByRole('button',{name:'Compartir ubicación',exact:true}).click();expect((await registeredGps).status()).toBe(200);
    const delivery=source.waitForResponse(r=>r.url().endsWith(`/api/manifiestos/${manifest.id}/confirmar-entrega-idempotente`)&&r.request().method()==='POST');
    await source.getByRole('button',{name:'Confirmar entrega',exact:true}).click();await source.getByRole('dialog',{name:'Confirmar Entrega?',exact:true}).getByRole('button',{name:'Sí, Confirmar Entrega',exact:true}).click();expect((await delivery).status()).toBe(200);
    await replacement.reload();await expect(replacement.getByRole('alert')).toContainText('ya no está activo');
    await replacement.goto(mp+'/transporte/perfil');const ownHistory=replacement.getByRole('region',{name:'Relevos a mi cargo',exact:true});await ownHistory.getByRole('button',{name:'Historial',exact:true}).click();const ownNumber=ownHistory.getByText(manifest.numero,{exact:true});await expect(ownNumber).toBeVisible();await expect(ownNumber.locator('xpath=../..').getByText(/Finalizado ·/)).toBeVisible();
    expect(errors).toEqual([]);
  }finally{for(const context of [sourceContext,externalContext,adminContext,replacementContext])await context.close().catch(()=>{});}
});
