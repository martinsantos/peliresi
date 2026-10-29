import {expect,test,devices,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {isolatedMapTiles,login,prefix,readablePageHeading} from './helpers';
import {assertCloudDatabase} from '../safety';

async function hashDownload(page:Page){
 const wait=page.waitForEvent('download',{timeout:20000});
 await page.getByRole('button',{name:'Descargar final',exact:true}).click({timeout:20000});
 const file=await wait;expect(await file.failure()).toBeNull();
 const stream=await file.createReadStream(),chunks:Buffer[]=[];
 for await(const chunk of stream)chunks.push(Buffer.from(chunk));
 const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,4).toString()).toBe('%PDF');
 return createHash('sha256').update(bytes).digest('hex');
}

test('origin final certificate reaches all linked parties and its real mail link survives login',async({browser},info)=>{
 await assertCloudDatabase();
 const out=process.env.QA_ARTIFACTS!,report=JSON.parse(readFileSync(path.join(out,'insitu-certificates.json'),'utf8'));
 expect(report.synthetic).toBe(true);expect(report.externalDelivery).toBe(false);
 const proof=report.results.find((item:any)=>item.surface===info.project.name);
 expect(proof?.noTripOrGps).toBe(true);
 const contexts=[],errors:string[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:390,height:844}};
 try{
  for(const role of ['generador','transportista'] as const){
   const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(context);
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   await isolatedMapTiles(page,info);
   await context.addCookies([{name:'sitrep_qa_client',value:`127.25.${info.project.name==='app'?2:1}.${role==='generador'?1:2}`,url:'http://127.0.0.1:4177'}]);
   await page.addInitScript(()=>{for(const role of ['GENERADOR','TRANSPORTISTA','OPERADOR'])localStorage.setItem('sitrep_onboarding_'+role,'true');});
   await page.setContent(readFileSync(path.join(out,proof.mails[role]),'utf8'));
   const link=page.locator(`[data-mail-action="${info.project.name==='app'?'app':'web'}"]`);
   await expect(link).toHaveCount(1);const target=new URL((await link.getAttribute('href'))!);
   expect(target.pathname).toBe(prefix(info)+'/manifiestos/'+proof.id);
   expect(target.searchParams.get('certificado')).toBe(proof.finalId);
   await page.screenshot({path:info.outputPath('correo-'+role+'.png'),fullPage:true});
   await link.click();await expect(page).toHaveURL(/\/login$/);
   await page.getByLabel('Correo electrónico o CUIT').fill(role+'@night-qa.invalid');
   await page.getByLabel('Contraseña',{exact:true}).fill('OnlyLocal-NightQA-2026!');
   const response=page.waitForResponse(res=>res.url().endsWith('/api/auth/login')&&res.request().method()==='POST');
   await page.getByRole('button',{name:'Ingresar',exact:true}).click();expect((await response).status()).toBe(200);
   await expect(page).toHaveURL(target.href);
   const welcome=page.getByRole('button',{name:'Saltar introducción',exact:true});
   if(await welcome.isVisible())await welcome.click();
   const card=page.locator('[data-certificate-id="'+proof.finalId+'"]');await expect(card).toBeVisible();
   expect(await hashDownload(page)).toBe(proof.finalSha256);
   await expect(page.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
   await readablePageHeading(page);await page.screenshot({path:info.outputPath('certificado-'+role+'.png'),animations:'disabled'});
   await page.goto(prefix(info)+'/notificaciones/'+proof.notices[role]);
   await expect(page.getByRole('region',{name:'Aviso recibido'})).toContainText('Certificación final total disponible');
   await page.getByRole('link',{name:'Ver certificación y descargar →',exact:true}).click();
   await expect(page).toHaveURL(target.href);await expect(card).toBeVisible();
  }
  const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(context);
  const operator=await context.newPage();operator.on('pageerror',error=>errors.push(error.message));await login(operator,info,'operador');
  await operator.goto(prefix(info)+'/manifiestos/'+proof.id+'?certificado='+proof.finalId+'#certificaciones');
  await expect(operator.locator('[data-certificate-id="'+proof.finalId+'"]')).toBeVisible();
  expect(await hashDownload(operator)).toBe(proof.finalSha256);
  expect(errors).toEqual([]);
 }finally{for(const context of contexts)await context.close().catch(()=>{});}
});
