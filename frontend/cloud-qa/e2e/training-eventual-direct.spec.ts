import {test,expect,devices,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {directTrainingLogin} from '../direct-training-login';
import {approveExceptionalJourney} from '../exceptional-journey';
import {prefix} from './helpers';

test('printed eventual exercise works between direct generator and operator accounts',async({browser},info)=>{
 const published=process.env.QA_TRAINING_PUBLISHED==='true';
 const scope={manifests:new Set<string>(),eventuals:new Set<string>()};
 const contexts=[],pages:Record<string,Page>={},errors:string[]=[];
 let record:any;
 try{
  for(const role of ['generador','operador']){
   const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:360,height:800},deviceScaleFactor:1,serviceWorkers:'block',
    baseURL:published?'https://sitrep.ultimamilla.com.ar':'http://127.0.0.1:4177',
    ...(published?{proxy:{server:process.env.QA_TRAINING_PROXY!}}:{})});
   contexts.push(context);const page=await context.newPage();pages[role]=page;page.setDefaultTimeout(20000);
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400 && !(r.status()===403 && new URL(r.url()).pathname==='/api/push/vapid-key'))errors.push(r.status()+' '+new URL(r.url()).pathname);});
   await directTrainingLogin(page,info,role,scope);
  }
  const {generador,operador}=pages;
  await generador.goto(prefix(info)+'/manifiestos');
  await generador.getByRole('link',{name:'Eventuales',exact:true}).click();
  await generador.getByRole('button',{name:'Registrar operación',exact:true}).click();
  await generador.getByRole('button',{name:'Operador · Buscar en padrón',exact:true}).click();
  await generador.getByLabel('Operador del padrón',{exact:true}).click();
  await generador.getByRole('option',{name:/^CAP · Operador 1 ·/}).click();
  await generador.getByLabel('Corriente',{exact:true}).fill('Y1');
  await generador.getByLabel('Cantidad',{exact:true}).fill('10');
  await generador.getByLabel('Motivo del registro excepcional',{exact:true}).fill('CAP: datos del transporte pendientes');
  const created=generador.waitForResponse(r=>r.url().endsWith('/api/manifiestos/baja-intensidad')&&r.request().method()==='POST');
  await generador.getByRole('button',{name:'Guardar operación',exact:true}).click();
  const response=await created;expect(response.status()).toBe(201);expect(response.headers()['x-sitrep-training']).toBe('true');
  record=(await response.json()).data.registro;expect(record.numeroOficial).toBeNull();
  expect(record.datos.transportista).toMatchObject({nombre:'',identificacion:'',domicilio:''});
  await approveExceptionalJourney(generador,'quien lo creó');
  const url=prefix(info)+'/manifiestos/baja-intensidad?registro='+record.id;
  await operador.goto(url);
  await expect(operador.getByRole('button',{name:'Registrar retirado',exact:true})).toBeDisabled();
  await approveExceptionalJourney(operador,'operador');
  await generador.goto(url);
  await expect(generador.getByText('Aprobación de las partes: aprobado',{exact:true})).toBeVisible();
  async function action(page:Page,label:string){
   const pending=page.waitForResponse(r=>r.url().endsWith('/'+record.id+'/eventos')&&r.request().method()==='POST');
   await page.getByRole('button',{name:label,exact:true}).click();
   const response=await pending;expect(response.status()).toBe(200);expect(response.headers()['x-sitrep-training']).toBe('true');
  }
  await action(generador,'Registrar retirado');
  await operador.goto(url);
  await expect(operador.getByRole('status',{name:'Estado operativo'})).toHaveText('Operación: Retirado');
  await action(operador,'Registrar recibido');await action(operador,'Registrar tratado');
  for(const [role,page] of Object.entries(pages)){
   await page.goto(url);
   await expect(page.getByRole('status',{name:'Estado operativo'})).toHaveText('Operación: Tratado');
   await expect(page.getByText('Sin número oficial',{exact:false})).toBeVisible();
   await expect(page.getByText('Capacitación · sin validez oficial',{exact:false}).first()).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
   await page.screenshot({path:info.outputPath(role+'-eventual.png'),fullPage:true,animations:'disabled'});
  }
  expect(errors).toEqual([]);
 }finally{
  writeFileSync(info.outputPath('eventual-evidence.json'),JSON.stringify({surface:info.project.name,recordId:record?.id,errors},null,2));
  for(const context of contexts)await context.close();
 }
});
