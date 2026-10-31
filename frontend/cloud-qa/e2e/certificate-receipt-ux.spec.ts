import {test,expect,devices,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {login,prefix} from './helpers';

const attempt=process.env.QA_CASE_ATTEMPT||'initial';
const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/certificate-receipt-fixture'+(attempt==='initial'?'':'-'+attempt)+'.json','utf8'));
async function sign(page:Page) {
 const canvas=page.locator('#certificaciones canvas');await canvas.scrollIntoViewIfNeeded();const b=(await canvas.boundingBox())!;
 await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5);await page.mouse.down();
 for(const [x,y] of [[.2,.2],[.4,.6],[.6,.2],[.8,.7]])await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:5});
 await page.mouse.up();await page.getByRole('button',{name:'Usar firma',exact:true}).click();
}
async function downloadHash(page:Page) {
 const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar parcial 1',exact:true}).click();
 const stream=await (await waiting).createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));
 const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,4).toString()).toBe('%PDF');return createHash('sha256').update(bytes).digest('hex');
}
test('a lost response is recovered once and the exact document replaces repeated receipt details',async({browser},info)=>{
 const m=fixture.cases[info.project.name],p=prefix(info),errors:string[]=[];
 const options=info.project.name==='app'?{...devices['Pixel 7'],viewport:{width:320,height:800}}:{...devices['Desktop Chrome'],viewport:{width:1365,height:900}};
 const operator=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
 const counterpart=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
 try {
  const page=await operator.newPage();page.on('pageerror',e=>errors.push(e.message));await login(page,info,'operador');
  await page.goto(p+'/manifiestos/'+m.id);const section=page.getByRole('region',{name:'Certificaciones',exact:true});await expect(section).toBeVisible();
  await section.getByRole('button',{name:'Emitir certificación parcial',exact:true}).click();
  await page.getByLabel('Cantidad a certificar Y1 (kg)',{exact:true}).fill('4');await sign(page);
  let record:any,posts=0,failGet=false,delayGet=false,aborted=false;
  await page.route('**/api/manifiestos/'+m.id+'/certificados',async route=>{
   if(route.request().method()==='POST'){
    posts++;const response=await route.fetch();expect(response.status()).toBe(201);record=(await response.json()).data;
    await route.abort('failed');aborted=true;return;
   }
   if(failGet){await route.fulfill({status:503,contentType:'application/json',body:'{"message":"QA sin conexión"}'});return;}
   if(delayGet)await new Promise(resolve=>setTimeout(resolve,500));
   await route.continue();
  });
  await section.getByRole('button',{name:'Firmar y publicar certificación',exact:true}).click();
  await expect(section.getByText('Emisión pendiente de confirmación')).toBeVisible();
  await expect.poll(()=>aborted&&!!record?.id,{timeout:30000}).toBe(true);
  await page.reload();await expect(section.getByText('Emisión pendiente de confirmación')).toBeVisible();
  const recovered=page.waitForResponse(r=>r.url().endsWith('/certificados/'+record.id+'/recuperar')&&r.request().method()==='POST');
  await section.getByRole('button',{name:'Comprobar resultado',exact:true}).click();expect((await recovered).status()).toBe(200);
  const receipt=section.locator('[aria-label="Recuperación de certificación"]');await expect(receipt.getByText('Certificación emitida')).toBeVisible();
  await section.getByRole('button',{name:'Actualizar certificados',exact:true}).click();
  const card=section.locator('[data-certificate-id="'+record.id+'"]');await expect(card).toBeVisible();await expect(card).toContainText('Y1: 4 kg');
  await expect(receipt.getByText(record.numero,{exact:true})).toBeHidden();await expect(receipt.getByText(/Y1: 4 kg/)).toBeHidden();
  await expect(section.getByText('Continuá para emitir')).toBeVisible();await expect(section.getByText('Todo listo para firmar la certificación final total.')).toHaveCount(0);
  const acknowledge=receipt.getByRole('button',{name:'Continuar con certificados',exact:true});
  expect((await acknowledge.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await section.screenshot({path:info.outputPath('certificate-compact.png'),animations:'disabled'});
  expect(await downloadHash(page)).toBe(record.pdfSha256);
  failGet=true;await section.getByRole('button',{name:'Actualizar certificados',exact:true}).click();
  await expect(section.getByText(/No se pudieron comprobar los certificados/)).toBeVisible({timeout:30000});
  await expect(receipt.getByText(record.numero,{exact:true})).toBeVisible();await expect(receipt.getByText(/Y1: 4 kg/)).toBeVisible();
  failGet=false;delayGet=true;await section.getByRole('button',{name:'Reintentar certificados',exact:true}).click();await acknowledge.focus();
  await expect(card).toBeVisible();await expect(receipt.getByText(record.numero,{exact:true})).toBeHidden();await expect(acknowledge).toBeFocused();
  expect(posts).toBe(1);await acknowledge.click();await expect(receipt).toHaveCount(0);
  const other=await counterpart.newPage();other.on('pageerror',e=>errors.push(e.message));
  const role=info.project.name==='app'?'transportista':'generador';await login(other,info,role);await other.goto(p+'/notificaciones');
  const notice=other.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:record.numero});
  await expect(notice).toBeVisible({timeout:40000});await notice.getByRole('button',{name:/^Abrir aviso:/}).click();
  const target=other.locator('[data-certificate-id="'+record.id+'"]');
  const choose=other.getByRole('button',{name:/^Usar .* y abrir certificado$/});
  await expect(target.or(choose).first()).toBeVisible({timeout:30000});if(await choose.isVisible())await choose.click();
  await expect(other).toHaveURL(new RegExp(p+'/manifiestos/'+m.id+'\\?certificado='+record.id+'#certificaciones$'));
  await expect(target).toBeVisible({timeout:30000});expect(await downloadHash(other)).toBe(record.pdfSha256);
  expect(errors).toEqual([]);writeFileSync(info.outputPath('proof.json'),JSON.stringify({surface:info.project.name,synthetic:true,record,posts,otherRole:role,lostResponse:true,offlineFallback:true,samePdf:true}));
 } finally {await operator.close();await counterpart.close();}
});
test('manual shows the current certificate recovery guidance and preview capture',async({page},info)=>{
 await page.goto('/manual/tutorial.html?guide=certificados-operador-partes');
 const step=page.locator('.guide-step').filter({has:page.getByRole('heading',{name:'Recuperar una emisión al cerrar web o app',exact:true})});
 await expect(step).toBeVisible();await expect(step).toContainText('el recibo conserva esos datos');
 const image=step.locator('img');await image.scrollIntoViewIfNeeded();
 await expect(image).toHaveAttribute('src',/certificate-recovery-list-20261030\.png/);
 await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:info.outputPath('manual.png'),animations:'disabled'});
});
