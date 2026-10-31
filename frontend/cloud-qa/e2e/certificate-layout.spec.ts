import {test,expect,type Locator} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {login,prefix,readableWholeWords} from './helpers';

const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/fixture.json','utf8'));
if(fixture.synthetic!==true)throw Error('Se requieren datos artificiales comprobados');
async function downloadedHash(button:Locator){
 const waiting=button.page().waitForEvent('download');await button.click();
 const stream=await(await waiting).createReadStream(),chunks:Buffer[]=[];
 for await(const chunk of stream)chunks.push(Buffer.from(chunk));
 const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,4).toString()).toBe('%PDF');
 return createHash('sha256').update(bytes).digest('hex');
}
for(const role of ['generador','transportista','operador'])test(`${role}: issued certificates stay accessible without repeated summaries`,async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await login(page,info,role);
 const partial=fixture.certificates.find((d:any)=>d.tipo==='PARCIAL'),final=fixture.certificates.find((d:any)=>d.tipo==='FINAL');
 expect(partial).toBeTruthy();expect(final).toBeTruthy();
 await page.goto(prefix(info)+'/manifiestos/'+fixture.id+'?certificado='+final.id+'#certificaciones');
 const section=page.getByRole('region',{name:'Certificaciones',exact:true});
 const finalRow=section.locator('[data-certificate-id="'+final.id+'"]');
 await expect(finalRow).toBeVisible({timeout:30000});
 await expect(section.getByRole('group',{name:'Estado de certificaciones'})).toHaveCount(0);
 const list=section.getByRole('list',{name:'Certificaciones emitidas'});
 await expect(list.getByRole('listitem')).toHaveCount(2);
 await expect(list.getByText('Certificación parcial 1 · Emitida',{exact:true})).toHaveCount(1);
 await expect(list.getByText('Certificación final total · Emitida',{exact:true})).toHaveCount(1);
 await expect(finalRow).toHaveAttribute('id','certificado-'+final.id);
 await expect(section.getByRole('button',{name:'Emitir certificación parcial',exact:true})).toHaveCount(0);
 expect(await downloadedHash(section.getByRole('button',{name:'Descargar parcial 1',exact:true}))).toBe(partial.sha256);
 expect(await downloadedHash(section.getByRole('button',{name:'Descargar final',exact:true}))).toBe(final.sha256);
 const widths=[];
 for(const width of [320,393,768,1365,1920]){
  await page.setViewportSize({width,height:900});
  await finalRow.scrollIntoViewIfNeeded();
  await readableWholeWords(finalRow.getByText('Certificación final total · Emitida',{exact:true}));
  const bounds=await section.getByRole('button',{name:'Descargar final',exact:true}).boundingBox();
  expect(bounds).not.toBeNull();expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  widths.push({width,downloadHeight:bounds!.height});
 }
 await page.setViewportSize(info.project.name==='app'?{width:320,height:800}:{width:1365,height:900});
 await section.scrollIntoViewIfNeeded();
 await section.screenshot({path:info.outputPath('certifications.png'),animations:'disabled'});
 expect(errors).toEqual([]);
 writeFileSync(info.outputPath('proof.json'),JSON.stringify({synthetic:true,role,surface:info.project.name,documents:2,sameSignedPdf:true,directLink:true,widths,errors}));
});
