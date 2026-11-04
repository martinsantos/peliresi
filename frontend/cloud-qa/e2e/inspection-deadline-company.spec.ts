import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect,test,type Page } from '@playwright/test';
import { assertCloudDatabase } from '../safety';
import { login,prefix } from './helpers';
type Item={role:'GENERADOR'|'TRANSPORTISTA'|'OPERADOR';inspectionId:string;noticeId:string};
const fixtureFile=process.env.QA_INSPECTION_DEADLINE_FIXTURE||'fixture.json';
if(!/^fixture(?:-[a-z0-9-]+)?\.json$/.test(fixtureFile))throw new Error('Fixture de QA inválida');
const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,fixtureFile),'utf8')) as {email:string;cases:Record<string,Item[]>};
const roles={GENERADOR:'Generador',TRANSPORTISTA:'Transporte',OPERADOR:'Operador'} as const;
async function getNotice(page:Page,id:string){return page.evaluate(async noticeId=>{
 const response=await fetch('/api/notificaciones/'+noticeId,{headers:{Authorization:'Bearer '+localStorage.getItem('sitrep_access_token')}});
 return {status:response.status,body:await response.json()};
},id);}
test('representatives receive an overdue reminder and see it update after answering',async({page},info)=>{
 await assertCloudDatabase();expect(fixture.email).toMatch(/@night-qa\.invalid$/);
 const items=fixture.cases[info.project.name];expect(items.map(item=>item.role)).toEqual(['GENERADOR','TRANSPORTISTA','OPERADOR']);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await login(page,info,fixture.email.split('@')[0]);
 for(const item of items){
  const detail=await getNotice(page,item.noticeId);expect(detail.status).toBe(200);expect(detail.body.data.titulo).toBe('Requerimiento vencido sin respuesta');
  const number=JSON.parse(detail.body.data.datos).numero as string;
  await page.goto(prefix(info)+'/notificaciones');
  const list=page.getByRole('list',{name:'Avisos',exact:true});
  const action=list.getByRole('button',{name:'Abrir aviso: Requerimiento vencido sin respuesta',exact:true}).filter({hasText:number});
  await expect(action).toBeVisible();await action.click();
  await expect(page).toHaveURL(new RegExp('/notificaciones/'+item.noticeId+'$'));
  const notice=page.getByRole('region',{name:'Aviso recibido'});await expect(notice).toContainText(number);
  await notice.getByRole('button',{name:`Usar ${roles[item.role]} y abrir requerimiento`,exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/requerimientos/'+item.inspectionId+'(?:[?#].*)?$'));
  await expect(page.getByTestId('inspection-next-step')).toBeVisible();
  await expect(page.getByRole('button',{name:/^Responder requerimiento #/})).toBeVisible();
  await expect(page.getByRole('link',{name:'Mis inspecciones',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath('plazo-'+item.role.toLowerCase()+'.png'),animations:'disabled'});
  await page.getByRole('button',{name:/^Responder requerimiento #/}).click();
  await page.getByRole('combobox',{name:'Tipo de actuación',exact:true}).selectOption('RESPUESTA');
  await page.getByLabel('Contenido',{exact:true}).fill('QA respuesta artificial a un requerimiento vencido, para actualizar el aviso.');
  const saved=page.waitForResponse(response=>response.url().endsWith('/inspecciones/'+item.inspectionId+'/intercambios')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Presentar en expediente',exact:true}).click();expect((await saved).status()).toBe(201);
  await expect(page.getByTestId('inspection-next-step')).toContainText('Tu presentación está registrada');
  const updated=await getNotice(page,item.noticeId);expect(updated.status).toBe(200);expect(updated.body.data.titulo).toBe('Estado actualizado de requerimiento');
  expect(updated.body.data.mensaje).not.toContain('todavía no hay una respuesta');
  await page.goto(prefix(info)+'/notificaciones/'+item.noticeId);
  await expect(page.getByRole('region',{name:'Aviso recibido'}).getByRole('heading',{name:'Estado actualizado de requerimiento',exact:true})).toBeVisible();
 }
 expect(errors).toEqual([]);
});
