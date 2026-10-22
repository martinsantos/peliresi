import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { login, prefix, isolatedMapTiles } from './helpers';
import { assertCloudDatabase, backendRequire } from '../safety';
import { syntheticCuit } from '../synthetic-cuit';
import { randomUUID } from 'node:crypto';
const fixtures=()=>JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/representation-fixture.json','utf8'));
test('registration accepts a valid pasted CUIT with spaces and normalizes the account email before saving',async({page},info)=>{
 await isolatedMapTiles(page,info);const email=randomUUID()+'@night-qa.invalid',cuit=syntheticCuit(Date.now());
 await page.goto(prefix(info)+'/inscripcion/generador');
 await page.getByLabel('Nombre completo *',{exact:true}).fill('QA identidad copiada');
 await page.getByLabel('Email *',{exact:true}).fill(email.toUpperCase());
 await page.getByLabel('CUIT *',{exact:true}).fill(cuit.replaceAll('-',' '));
 await page.getByLabel('Contraseña *',{exact:true}).fill('OnlyLocal-NightQA-2026!');
 await page.getByLabel('Confirmar contraseña *',{exact:true}).fill('OnlyLocal-NightQA-2026!');
 const created=page.waitForResponse(r=>r.url().endsWith('/solicitudes/iniciar')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Crear cuenta y continuar',exact:true}).click();
 const response=await created;expect(response.status()).toBe(201);expect(response.request().postDataJSON().email).toBe(email);
 await expect(page.getByLabel('Razon Social *',{exact:true})).toBeVisible();
});

test('a real company notice preserves the open draft until its owner chooses how to reconcile it',async({page},info)=>{
 const f=fixtures()[info.project.name];await isolatedMapTiles(page,info);
 await login(page,info,f.prefix);await page.goto(prefix(info)+'/empresas?empresa='+f.companyId);
 await page.getByLabel('Calle legal',{exact:true}).fill('Domicilio que estoy completando');
 await page.getByLabel('Motivo del cambio legal',{exact:true}).fill('Conservar el trabajo de la persona');
 const response=await page.request.post('/api/auth/login',{data:{email:'admin@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'}});expect(response.status()).toBe(200);
 const headers={Authorization:'Bearer '+(await response.json()).data.tokens.accessToken};
 const before=await page.request.get('/api/empresas/'+f.companyId,{headers});expect(before.status()).toBe(200);const company=(await before.json()).data.empresa;
 const update=await page.request.put('/api/empresas/'+f.companyId,{headers,data:{revision:company.revision,razonSocial:company.razonSocial,nombreFantasia:'Cambio concurrente QA',domicilioLegal:{calle:'Domicilio recibido por SITREP',localidad:'Mendoza',departamento:'Capital'},motivo:'Actualización artificial concurrente'}});expect(update.status()).toBe(200);
 await expect(page.getByText('Otra persona actualizó estos datos',{exact:true})).toBeVisible({timeout:45_000});
 await expect(page.getByLabel('Calle legal',{exact:true})).toHaveValue('Domicilio que estoy completando');
 await expect(page.getByLabel('Motivo del cambio legal',{exact:true})).toHaveValue('Conservar el trabajo de la persona');
 await expect(page.getByRole('button',{name:'Guardar datos legales',exact:true})).toBeDisabled();
 await expect(page.getByText('Domicilio recibido por SITREP',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Conservar mis cambios',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('company-draft-conflict.png'),animations:'disabled'});
 await page.getByText('Otra persona actualizó estos datos',{exact:true}).locator('..').screenshot({path:info.outputPath('manual-company-conflict.png'),animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.getByRole('button',{name:'Conservar mis cambios',exact:true}).click();
 const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/empresas/'+f.companyId);
 await page.getByRole('button',{name:'Guardar datos legales',exact:true}).click();expect((await saved).status()).toBe(200);
 await expect(page.getByText('Cambios guardados',{exact:true})).toBeVisible();
 const after=await page.request.get('/api/empresas/'+f.companyId,{headers});expect(after.status()).toBe(200);
 const result=(await after.json()).data.empresa;
 expect(result.domicilioLegal.calle).toBe('Domicilio que estoy completando');
 expect(result.nombreFantasia).toBe('Cambio concurrente QA');
});

test('two representatives share a CUIT, receive notices and lose revoked authority without changing identity',async({page,browser},info)=>{
 const f=fixtures()[info.project.name],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await isolatedMapTiles(page,info);
 await login(page,info,f.prefix);await page.goto(prefix(info)+'/empresas?empresa='+f.companyId);
 await page.getByRole('button',{name:'Personas autorizadas',exact:true}).click();
 await expect(page.getByText('1 de 2',{exact:true})).toBeVisible();
 const email=f.prefix+'-member@night-qa.invalid';
 await page.getByLabel('Correo de la persona',{exact:true}).fill(email);
 await page.getByRole('button',{name:'Preparar invitación',exact:true}).click();
 const invitation=page.getByLabel('Enlace de invitación',{exact:true});await expect(invitation).toBeVisible();
 const address=await invitation.inputValue();await expect(page.getByText('2 de 2',{exact:true})).toBeVisible();
 await page.getByLabel('Correo de la persona',{exact:true}).fill('third@night-qa.invalid');
 await expect(page.getByRole('button',{name:'Autorizar cuenta verificada',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Preparar invitación',exact:true})).toBeDisabled();
 const context=await browser.newContext({viewport:page.viewportSize()||{width:1440,height:900}}),member=await context.newPage();await isolatedMapTiles(member,info);
 try {
  await member.goto(address);await member.getByLabel('Contraseña de tu cuenta',{exact:true}).fill('OnlyLocal-NightQA-2026!');
  await member.getByRole('button',{name:'Aceptar acceso a empresa',exact:true}).click();await expect(member.getByText('Acceso autorizado. Tu sesión anterior no se modificó.',{exact:true})).toBeVisible();
  await login(member,info,f.prefix+'-member');await member.goto(prefix(info)+'/empresas?empresa='+f.companyId);
  await expect(member.getByRole('heading',{name:'Empresas y establecimientos',exact:true})).toBeVisible();
  await expect(member.getByRole('button',{name:'Personas autorizadas',exact:true})).toHaveCount(0);
  await page.reload();await page.getByRole('button',{name:'Personas autorizadas',exact:true}).click();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Designar responsable',exact:true}).click();
  const summary=page.getByRole('heading',{name:'Personas de esta entidad',exact:true}).locator('../..');
  await expect(summary.getByText('Responsable ante SITREP',{exact:true})).toHaveCount(2);
  await summary.screenshot({path:info.outputPath('manual-entity-people.png'),animations:'disabled'});
  await page.screenshot({path:info.outputPath('two-representatives.png'),fullPage:true});
  await member.reload();await expect(member.getByRole('button',{name:'Personas autorizadas',exact:true})).toBeVisible();
  await member.goto(prefix(info)+'/notificaciones');await expect(member.getByText('Responsable designado',{exact:true}).first()).toBeVisible();
  const person=summary.getByText('QA representante '+info.project.name,{exact:true}).locator('../..');
  page.once('dialog',d=>d.accept());await person.getByRole('button',{name:'Retirar responsabilidad',exact:true}).click();
  await expect(summary.getByText('Responsable ante SITREP',{exact:true})).toHaveCount(1);
  await member.goto(prefix(info)+'/empresas?empresa='+f.companyId);await expect(member.getByRole('button',{name:'Personas autorizadas',exact:true})).toHaveCount(0);
  await page.getByLabel('Motivo de revocación',{exact:true}).fill('Fin de representación artificial');
  const access=page.getByRole('heading',{name:'Accesos e invitaciones',exact:true}).locator('..').getByText('QA representante '+info.project.name,{exact:true}).locator('../..');
  await access.getByRole('button',{name:'Revocar acceso',exact:true}).click();await expect(page.getByText('1 de 2',{exact:true})).toBeVisible();
  await member.goto(prefix(info)+'/notificaciones');await expect(member.getByText('Acceso a la entidad revocado',{exact:true}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(await member.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
 } finally {await context.close();}
});

test('revoked selected activity returns to the personal profile with an explanation and preserves the other role',async({page},info)=>{
 await assertCloudDatabase();expect(new URL(process.env.DATABASE_URL!).searchParams.get('schema')).toBe('actor_representation_20261022');
 const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
 const owner=await db.usuario.findUniqueOrThrow({where:{email:'multirol-'+info.project.name+'@night-qa.invalid'},include:{operador:true}});
 const response=await page.request.post('/api/auth/login',{data:{email:'admin@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'}});expect(response.status()).toBe(200);
 const token=(await response.json()).data.tokens.accessToken;
 const change=async(activo:boolean)=>{const r=await page.request.put('/api/actores/operadores/'+owner.operador.id,{headers:{Authorization:'Bearer '+token},data:{activo}});expect(r.status()).toBe(200);};
 try {
  await login(page,info,'multirol-'+info.project.name);await page.goto(prefix(info)+'/mi-perfil');
  await page.getByRole('button',{name:'Usar Operador',exact:true}).click();await expect(page.getByRole('button',{name:'Operador · En uso',exact:true})).toBeDisabled();
  await change(false);await page.reload();
  await expect(page.getByText('Esta actividad ya no está disponible. Elegí otra actividad aprobada desde Mi perfil.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Generador · En uso',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Usar Operador',exact:true})).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login$/);
  await page.screenshot({path:info.outputPath('revoked-activity-recovery.png'),fullPage:true});
 } finally {await change(true);await db.$disconnect();}
});

test('manual explains shared identity, two people and separate revocations without changing its layout',async({page},info)=>{
 await isolatedMapTiles(page,info);const errors:string[]=[],writes:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))writes.push(r.method());});
 await page.goto('/manual/tutorial.html?guide=entidad-actividades-representantes');
 await expect(page.locator('#tutorialTitle')).toHaveText('Una entidad, varias actividades y dos personas');
 await expect(page.locator('.guide-step')).toHaveCount(6);
 for(const phrase of ['hasta dos personas en total','no aumenta','Retirar responsabilidad','correos/push apagados','contraseñas'])await expect(page.locator('body')).toContainText(phrase);
 const captures=page.locator('.guide-step img.guide-image');await expect(captures).toHaveCount(2);
 await captures.evaluateAll(images=>images.forEach(image=>{(image as HTMLImageElement).loading='eager';}));
 await expect.poll(()=>captures.evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
 await page.evaluate(()=>document.fonts.ready.then(()=>true));expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath('manual-representatives.png'),animations:'disabled'});expect(errors).toEqual([]);expect(writes).toEqual([]);
});
