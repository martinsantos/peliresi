import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { login, prefix, isolatedMapTiles } from './helpers';

test('invitation recovery makes the confirmed result visible and focused without repeating acceptance',async({page},info)=>{
 const token='a'.repeat(64),password='SoloPrueba-NoGuardar-2026!';
 const submissions:Array<{soloConsultar?:boolean}>=[];
 await page.route('**/api/empresas/invitaciones/'+token+'**',async route=>{
  if(route.request().method()==='GET'){
   await route.fulfill({json:{data:{empresa:'Empresa QA',email:'persona@night-qa.invalid',rol:'GENERADOR',venceAt:'2099-01-01T00:00:00Z'}}});return;
  }
  const body=route.request().postDataJSON() as {soloConsultar?:boolean};submissions.push({soloConsultar:body.soloConsultar});
  if(submissions.length===1){await route.abort('failed');return;}
  await route.fulfill({json:{data:{aceptada:true,recuperada:true}}});
 });
 await page.goto(prefix(info)+'/empresa-invitacion/'+token);
 await page.getByLabel('Contraseña de tu cuenta').fill(password);
 await page.getByRole('button',{name:'Aceptar acceso a empresa',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('No recibimos la confirmación');
 await page.getByRole('button',{name:'Comprobar aceptación',exact:true}).click();
 const result=page.getByRole('status');await expect(result).toContainText('ya fue aceptada');await expect(result).toBeFocused();
 const outline=await result.evaluate(el=>{const css=getComputedStyle(el);return {style:css.outlineStyle,width:parseFloat(css.outlineWidth)};});
 expect(outline.style).not.toBe('none');expect(outline.width).toBeGreaterThanOrEqual(2);
 expect(submissions).toHaveLength(2);expect(submissions[0].soloConsultar).toBeUndefined();expect(submissions[1].soloConsultar).toBe(true);
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain(password);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath('invitation-recovery-focus.png'),animations:'disabled'});
});

test('one identity keeps three roles within two people and recovers revoked access without duplicate invitations',async({page,browser},info)=>{
 const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/edge-fixtures.json','utf8'))[info.project.name];
 const errors:string[]=[],consoleMessages:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleMessages.push(m.text());});
 await isolatedMapTiles(page,info);await login(page,info,fixture.prefix);
 await page.goto(prefix(info)+'/empresas?empresa='+fixture.companyId);
 await expect(page.getByRole('heading',{name:'Empresas y establecimientos',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Personas autorizadas',exact:true}).click();
 await expect(page.getByText('1 de 2',{exact:true})).toBeVisible();
 const email=fixture.prefix+'-member@night-qa.invalid';
 await page.getByLabel('Correo de la persona',{exact:true}).fill(email);
 for(const activityId of fixture.activityIds){
  await page.getByLabel('Rol en esta empresa',{exact:true}).selectOption(activityId);
  await expect(page.getByText(/Este acceso fue revocado/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toBeDisabled();
  const saved=page.waitForResponse(r=>r.url().endsWith('/personas')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Autorizar cuenta verificada',exact:true}).click();expect((await saved).status()).toBe(201);
  await expect(page.getByText(/Esta persona ya está autorizada en este rol/)).toBeVisible();
  await expect(page.getByText('2 de 2',{exact:true})).toBeVisible();
 }
 const summary=page.getByRole('heading',{name:'Personas de esta entidad',exact:true}).locator('../..');
 await expect(summary.getByText('QA segunda persona',{exact:true})).toHaveCount(1);
 await summary.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('three-roles-two-people.png'),animations:'disabled'});
 const memberContext=await browser.newContext({viewport:page.viewportSize()!}),member=await memberContext.newPage();
 member.on('pageerror',e=>errors.push(e.message));await isolatedMapTiles(member,info);
 try{
  await login(member,info,fixture.prefix+'-member');
  for(const [label,role]of [['Generador','GENERADOR'],['Transportista','TRANSPORTISTA'],['Operador','OPERADOR']]){
   await member.goto(prefix(info)+'/empresas?empresa='+fixture.companyId);
   await expect(member.getByRole('button',{name:'Personas autorizadas',exact:true})).toHaveCount(0);
   await member.getByLabel('Actividad autorizada',{exact:true}).selectOption({label});
   await member.getByRole('button',{name:'Usar empresa y establecimiento',exact:true}).click();
   await expect(member.getByText('Actuando por QA entidad '+info.project.name+' · '+role,{exact:true})).toBeVisible();
   await expect(member.getByRole('main')).not.toBeEmpty();
   await member.screenshot({path:info.outputPath('representative-'+role.toLowerCase()+'.png'),animations:'disabled'});
  }
 }finally{await memberContext.close();}
 await page.getByLabel('Correo de la persona',{exact:true}).fill('third-'+fixture.prefix+'@night-qa.invalid');
 await expect(page.getByRole('button',{name:'Autorizar cuenta verificada',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toBeDisabled();
 await expect(page.getByText(/El cupo está completo/)).toBeVisible();
 await page.getByLabel('Motivo de revocación',{exact:true}).fill('QA salida de representante');
 const list=page.getByRole('heading',{name:'Accesos e invitaciones',exact:true}).locator('..');
 for(let n=0;n<3;n++){
  const row=list.locator('li').filter({hasText:email}).filter({has:page.getByRole('button',{name:'Revocar acceso',exact:true})}).first();
  await row.getByRole('button',{name:'Revocar acceso',exact:true}).click();
  await expect(page.getByText(n===2?'1 de 2':'2 de 2',{exact:true})).toBeVisible();
  await expect(list.locator('li').filter({hasText:email}).filter({has:page.getByRole('button',{name:'Revocar acceso',exact:true})})).toHaveCount(2-n);
 }
 await page.getByLabel('Correo de la persona',{exact:true}).fill('next-'+fixture.prefix+'@night-qa.invalid');
 await page.getByRole('button',{name:'Preparar invitación',exact:true}).click();
 await expect(page.getByLabel('Enlace de invitación',{exact:true})).toHaveValue(new RegExp(prefix(info)+'/empresa-invitacion/'));
 await expect(page.getByText(/Ya hay una invitación vigente/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toBeDisabled();
 await page.getByText(/Ya hay una invitación vigente/).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('invitation-guidance.png'),animations:'disabled'});
 await page.getByRole('button',{name:'Revocar invitación',exact:true}).click();
 await expect(page.getByText('1 de 2',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toBeEnabled();
 await expect(page.getByLabel('Enlace de invitación',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('vite-error-overlay,nextjs-portal')).toHaveCount(0);expect(await page.title()).toMatch(/SITREP/i);
 expect(errors).toEqual([]);await info.attach('console',{body:Buffer.from(JSON.stringify(consoleMessages)),contentType:'application/json'});
});
