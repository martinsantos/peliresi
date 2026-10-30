import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from '../safety';
import { login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync('/work/sitrep/.qa-eventual-notices-20261030/fixture.json','utf8'));
const phase = process.env.QA_EVENT_PHASE;
test.beforeAll(async () => {
 await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); expect(fixture.owner).toMatch(/@night-qa\.invalid$/);
 expect(['before','after']).toContain(phase); expect(process.env.QA_ARTIFACTS).toBe('/work/sitrep/.qa-eventual-event-draft-20261030');
 expect(process.env.DISABLE_EMAILS).toBe('true'); expect(process.env.PUSH_MANIFEST_NOTICES_ENABLED).toBe('false');
});
if (phase === 'after') test('una diferencia guardada con respuesta perdida se reconoce sin duplicarla', async ({page}, info) => {
 const marker='QA diferencia ' + randomUUID().slice(0,8);
 await login(page,info,fixture.owner.split('@')[0]);
 const url=prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId; await page.goto(url);
 await page.getByLabel('Nota de la acción').fill(marker); await page.getByRole('button',{name:'Registrar diferencia'}).click();
 await page.getByLabel('Corriente',{exact:true}).fill('Y12'); await page.getByLabel('Cantidad',{exact:true}).fill('8');
 let actionId='';
 await page.route('**/api/manifiestos/baja-intensidad/*/eventos',async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const response=await route.fetch(); expect(response.status()).toBe(200);
  actionId=route.request().postDataJSON().id; await route.abort('failed');
 });
 await page.getByRole('button',{name:'Guardar diferencia'}).click(); await expect.poll(() => actionId).not.toBe('');
 const context=page.context(); await page.close(); const reopened=await context.newPage(); await reopened.goto(url);
 await expect(reopened.getByText('La acción ya estaba guardada. Recuperamos la confirmación sin duplicarla.')).toBeVisible();
 const {PrismaClient}=backendRequire('@prisma/client'), db=new PrismaClient();
 try {
  const row=await db.registroManifiestoExcepcional.findUniqueOrThrow({where:{id:fixture.recordId},select:{eventos:true}});
  const matches=(row.eventos as any[]).filter(event => event.id === actionId);
  expect(matches).toHaveLength(1); expect(matches[0].nota).toBe(marker); expect(matches[0].residuos[0]).toMatchObject({corriente:'Y12',cantidad:8});
 } finally { await db.$disconnect(); }
});
if (phase === 'after') test('la nota del detalle queda aislada al cambiar de actividad', async ({page}, info) => {
 const marker='QA actividad ' + randomUUID().slice(0,8);
 await login(page,info,fixture.owner.split('@')[0]);
 const url=prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId; await page.goto(url);
 await page.getByLabel('Nota de la acción').fill(marker);
 await page.goto(prefix(info) + '/mi-perfil'); await page.getByRole('button',{name:'Usar Operador',exact:true}).click();
 await expect(page.getByRole('button',{name:'Operador · En uso',exact:true})).toBeDisabled();
 await page.goto(url); await expect(page.getByLabel('Nota de la acción')).toHaveValue('');
 await page.getByLabel('Nota de la acción').fill('QA nota operador');
 await page.goto(prefix(info) + '/mi-perfil'); await page.getByRole('button',{name:'Usar Generador',exact:true}).click();
 await expect(page.getByRole('button',{name:'Generador · En uso',exact:true})).toBeDisabled();
 await page.goto(url); await expect(page.getByLabel('Nota de la acción')).toHaveValue(marker);
});
if (phase === 'after') test('la aprobación del eventual sigue funcionando desde el detalle', async ({page}, info) => {
 await login(page,info,fixture.owner.split('@')[0]);
 const recordId=randomUUID();
 const status=await page.evaluate(async recordId => {
  const token=localStorage.getItem('sitrep_access_token');
  const external={nombre:'QA externo',identificacion:'QA',domicilio:'QA'};
  const response=await fetch('/api/manifiestos/baja-intensidad',{method:'POST',headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'},
   body:JSON.stringify({id:recordId,transportista:external,operador:external,patente:'QA-APROB',motivo:'QA aprobación artificial',residuos:[{corriente:'Y1',cantidad:1,unidad:'kg'}]})});
  return response.status;
 },recordId);
 expect(status).toBe(201);
 await page.goto(prefix(info) + '/manifiestos/baja-intensidad?registro=' + recordId);
 const approval=page.getByRole('button',{name:'Aprobar como quien lo creó'});
 await expect(approval).toBeEnabled(); await approval.click();
 await expect(page.getByText('Aprobación de las partes: aprobado')).toBeVisible();
 await expect(page.getByText('La acción quedó registrada.')).toBeVisible();
});
if (phase === 'after') test('la acción pendiente permanece accesible en móvil', async ({page}, info) => {
 await login(page,info,fixture.owner.split('@')[0]);
 await page.goto(prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId);
 await page.getByLabel('Nota de la acción').fill('QA acción sin conexión');
 await page.getByRole('button',{name:'Registrar diferencia'}).click();
 await page.getByLabel('Corriente',{exact:true}).fill('Y12'); await page.getByLabel('Cantidad',{exact:true}).fill('5');
 await page.route('**/api/manifiestos/baja-intensidad/*/eventos',async route => {
  if (route.request().method() !== 'POST') return route.continue();
  await route.abort('failed');
 });
 await page.getByRole('button',{name:'Guardar diferencia'}).click();
 const retry=page.getByRole('button',{name:'Comprobar acción'}); await expect(retry).toBeVisible();
 if (info.project.name === 'app') for (const width of [320,393]) {
  await page.setViewportSize({width,height:844}); await retry.scrollIntoViewIfNeeded();
  const geometry=await retry.evaluate(element => {
   const r=element.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   return {height:r.height,hit:!!hit && (hit===element || element.contains(hit)),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(geometry.height).toBeGreaterThanOrEqual(44); expect(geometry.hit).toBe(true); expect(geometry.overflow).toBeLessThanOrEqual(1);
 }
 await page.screenshot({path:info.outputPath('pending-action.png'),animations:'disabled'});
});
if (phase === 'after') test('dos pestañas no registran dos veces una diferencia', async ({page}, info) => {
 const marker='QA doble pestaña ' + randomUUID().slice(0,8);
 await login(page,info,fixture.owner.split('@')[0]);
 const url=prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId; await page.goto(url);
 const other=await page.context().newPage(); await other.goto(url);
 await page.getByLabel('Nota de la acción').fill(marker); await page.getByRole('button',{name:'Registrar diferencia'}).click();
 await page.getByLabel('Corriente',{exact:true}).fill('Y12'); await page.getByLabel('Cantidad',{exact:true}).fill('5');
 await expect(other.getByLabel('Nota de la acción')).toHaveValue(marker);
 let actionId='', release:()=>void=()=>{}; const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/manifiestos/baja-intensidad/*/eventos',async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const response=await route.fetch(); expect(response.status()).toBe(200);
  actionId=route.request().postDataJSON().id; await held; await route.fulfill({response});
 });
 try {
  await page.getByRole('button',{name:'Guardar diferencia'}).click(); await expect.poll(() => actionId).not.toBe('');
  const retry=other.getByRole('button',{name:'Comprobar acción'}); await expect(retry).toBeVisible(); await retry.click();
  await expect(other.getByText(/Otra pestaña está enviando/)).toBeVisible(); release();
  await expect(page.getByText('La acción quedó registrada.')).toBeVisible();
  const {PrismaClient}=backendRequire('@prisma/client'), db=new PrismaClient();
  try {
   const row=await db.registroManifiestoExcepcional.findUniqueOrThrow({where:{id:fixture.recordId},select:{eventos:true}});
   expect((row.eventos as any[]).filter(event=>event.id === actionId)).toHaveLength(1);
  } finally { await db.$disconnect(); }
 } finally { release(); await other.close(); }
});
test('la nota y la diferencia sobreviven al cierre del detalle', async ({page}, info) => {
 const marker = 'QA detalle ' + randomUUID().slice(0,8);
 await login(page,info,fixture.owner.split('@')[0]);
 const url = prefix(info) + '/manifiestos/baja-intensidad?registro=' + fixture.recordId;
 await page.goto(url);
 await page.getByLabel('Nota de la acción').fill(marker);
 await page.getByRole('button',{name:'Registrar diferencia'}).click();
 await page.getByLabel('Corriente',{exact:true}).fill('Y12');
 await page.getByLabel('Cantidad',{exact:true}).fill('8');
 const context=page.context(); await page.close(); const reopened=await context.newPage(); await reopened.goto(url);
 if (phase === 'before') {
  await expect(reopened.getByLabel('Nota de la acción')).toHaveValue('');
  await expect(reopened.getByRole('button',{name:'Registrar diferencia'})).toBeVisible();
  await reopened.getByRole('button',{name:'Registrar diferencia'}).click();
  await expect(reopened.getByLabel('Corriente',{exact:true})).toHaveValue('');
 } else {
  await expect(reopened.getByLabel('Nota de la acción')).toHaveValue(marker);
  await expect(reopened.getByLabel('Corriente',{exact:true})).toHaveValue('Y12');
  await expect(reopened.getByLabel('Cantidad',{exact:true})).toHaveValue('8');
 }
 await reopened.screenshot({path:info.outputPath('event-draft.png'),animations:'disabled'});
});
