import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';
const origin='http://127.0.0.1:4177';
const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fixture.json'),'utf8'));
test.beforeAll(async()=>{await assertCloudDatabase();expect(fixture.synthetic).toBe(true);});
for(const preference of ['web','app'] as const) test(`correo principal de ficha respeta preferencia ${preference} y actividad`,async({page,browser},info)=>{
 await login(page,info,fixture.owner.split('@')[0]);await page.goto(prefix(info)+'/configuracion?tab=apariencia');
 const settings=page.getByRole('region',{name:'Dónde abrir los enlaces'}),automatic=settings.getByRole('radio',{name:/Según el dispositivo/});
 const choice=settings.getByRole('radio',{name:preference==='web'?/Siempre web/:/Siempre app/});await expect(choice).toBeEnabled();
 let context:Awaited<ReturnType<typeof browser.newContext>>|undefined;
 try{
  if(await choice.isChecked()){await automatic.check();await expect(settings.getByRole('status')).toContainText('Preferencia guardada');}
  await choice.check();await expect(settings.getByRole('status')).toContainText('Preferencia guardada');await page.reload();await expect(choice).toBeChecked();
  context=await browser.newContext({...info.project.use,baseURL:origin} as any);const other=await context.newPage();await isolatedMapTiles(other,info);
  await context.addCookies([{name:'sitrep_qa_client',value:`127.25.${preference==='web'?84:85}.${info.project.name==='app'?2:1}`,url:origin}]);
  const item=fixture.created.operador;await other.setContent(item.mailHtml);await other.locator('[data-mail-action="preferred"]').click();
  await expect(other).toHaveURL(/\/login$/);await other.getByLabel('Correo electrónico o CUIT').fill(fixture.owner);
  await other.getByLabel('Contraseña',{exact:true}).fill('OnlyLocal-NightQA-2026!');
  const loginResponse=other.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
  await other.getByRole('button',{name:'Ingresar',exact:true}).click();expect((await loginResponse).status()).toBe(200);
  await expect(other.getByRole('dialog',{name:'Bienvenido a SITREP'})).toHaveCount(0);
  const base=origin+(preference==='app'?'/app':'');await expect(other).toHaveURL(base+'/notificaciones/'+item.notice);
  await other.getByRole('button',{name:'Usar Operador y ver comprobante',exact:true}).click();
  await expect(other).toHaveURL(base+'/mi-perfil?comprobante='+item.document+'&aviso='+item.notice+'#comprobante-aviso');
  const card=other.getByRole('region',{name:'Comprobante del aviso'});await expect(card).toContainText(item.documentName);await expect(card).toBeFocused();
  await other.screenshot({path:info.outputPath('preferencia-comprobante.png'),animations:'disabled'});
 }finally{await context?.close();if(!await automatic.isChecked()){await automatic.check();await expect(settings.getByRole('status')).toContainText('Preferencia guardada');}}
});
