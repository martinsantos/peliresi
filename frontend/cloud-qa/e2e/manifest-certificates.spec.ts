import {test,expect,devices,type Page,type TestInfo} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {login,prefix,readablePageHeading} from './helpers';
const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/certificate-browser-fixture.json','utf8'));
async function proof(page:Page,info:TestInfo,name:string) {
 await expect(page).toHaveTitle(/SITREP/);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 await expect(page.getByText('Capacitación · sin validez oficial',{exact:false})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await readablePageHeading(page);await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
}
async function sign(page:Page) {
 const canvas=page.locator('#certificaciones canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
 await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();
 for(const [x,y] of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});
 await page.mouse.up();await page.getByRole('button',{name:'Usar firma',exact:true}).click();
}
async function downloadHash(page:Page,kind:string) {
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:kind,exact:true}).click();const d=await waiting;const stream=await d.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,4).toString()).toBe('%PDF');return createHash('sha256').update(bytes).digest('hex');
}
test('operator issues signed partial and final; both parties receive notices and the identical PDF',async({browser},info)=>{
 const m=fixture.cases[info.project.name],route=prefix(info)+'/manifiestos/'+m.id,ep='/api/manifiestos/'+m.id+'/certificados';
 const contexts=[],pages:Record<string,Page>={},errors:string[]=[],documents:unknown[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of ['operador','generador','transportista']){const c=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'allow'});contexts.push(c);const p=await c.newPage();pages[role]=p;p.on('pageerror',e=>errors.push(e.message));p.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});await login(p,info,role);await p.goto(role==='operador'?route:prefix(info)+'/notificaciones');}
  const op=pages.operador;
  await expect(op.getByRole('region',{name:'Certificaciones',exact:true})).toBeVisible();
  for(const type of ['PARCIAL','FINAL']) {
   if(type==='FINAL')for(const role of ['generador','transportista'])await pages[role].goto(prefix(info)+'/notificaciones');
   await op.getByRole('button',{name:type==='PARCIAL'?'Emitir certificación parcial':'Emitir certificación final total',exact:true}).click();
   const amount=op.getByLabel('Cantidad a certificar Y1 (kg)',{exact:true});
   if(type==='PARCIAL'){await expect(amount).toHaveValue('10');await amount.fill('4');}else{await expect(amount).toHaveValue('10');await expect(amount).toBeDisabled();}
   await expect(op.getByLabel('Método de tratamiento certificado',{exact:true})).toHaveValue('QA tratamiento artificial');
   await expect(op.getByRole('button',{name:'Firmar y publicar certificación',exact:true})).toBeDisabled();
   await sign(op);await proof(op,info,type.toLowerCase()+'-ready');
   const waiting=op.waitForResponse(r=>r.url().endsWith(ep)&&r.request().method()==='POST');
   await op.getByRole('button',{name:'Firmar y publicar certificación',exact:true}).click();
   const res=await waiting;expect(res.status(),await res.text()).toBe(201);const record=(await res.json()).data;
   const downloadLabel=type==='PARCIAL'?'Descargar parcial 1':'Descargar final';
   expect(await downloadHash(op,downloadLabel)).toBe(record.pdfSha256);
   for(const role of ['generador','transportista']) {
    const p=pages[role],notice=p.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:record.numero});
    await expect(notice).toBeVisible({timeout:40000});await expect(notice).toContainText(type==='FINAL'?'Certificación final total disponible':'Certificación parcial disponible');
    await expect(notice).toContainText('Ver certificación y descargar');
    await proof(p,info,type.toLowerCase()+'-notice-'+role);
    await notice.getByRole('button',{name:/^Abrir aviso:/}).click();
    await expect(p).toHaveURL(new RegExp('/manifiestos/'+m.id+'\\?certificado='+record.id+'#certificaciones$'));
    const card=p.locator('[data-certificate-id="'+record.id+'"]');await expect(card).toBeVisible();
    await expect(p.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
    expect(await downloadHash(p,downloadLabel)).toBe(record.pdfSha256);
    const dismiss=p.getByRole('button',{name:'Cerrar notificación',exact:true});if(await dismiss.isVisible())await dismiss.click();
    await proof(p,info,type.toLowerCase()+'-document-'+role);
    if(type==='FINAL'&&role==='generador')await p.getByRole('region',{name:'Certificaciones',exact:true}).screenshot({path:info.outputPath('certificates-block.png'),animations:'disabled'});
   }
   documents.push(record);
  }
  await expect(op.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
  await expect(op.getByRole('button',{name:'Descargar Certificado',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);writeFileSync(info.outputPath('proof.json'),JSON.stringify({surface:info.project.name,manifest:m.id,documents,realLogins:3,cap:false,samePdfAcrossRoles:true,noticesReceivedWithoutReload:true,errors}));
 }finally{for(const c of contexts)await c.close();}
});
test('certificate guide keeps the manual layout and navigation',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/manual/tutorial.html?guide=certificados-operador-partes');
 await expect(page.locator('#tutorialTitle')).toHaveText('Certificaciones: emitir, recibir y descargar');
 await expect(page.locator('.guide-step')).toHaveCount(5);
 for(const text of ['no se suman dos veces','firma manuscrita','CAP cerrado','campana','adendas'])await expect(page.locator('body')).toContainText(text);
 if(info.project.name!=='web-desktop')await page.getByRole('button',{name:/Índice del tutorial/}).click();
 await page.locator('#tutorialIndex a').last().click();await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ratio:1});
 await page.reload();await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current','step');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:info.outputPath('manual-certificados.png'),animations:'disabled'});expect(errors).toEqual([]);
});
