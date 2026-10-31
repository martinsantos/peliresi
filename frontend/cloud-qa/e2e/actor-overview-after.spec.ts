import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {login,prefix,readablePageHeading} from './helpers';
const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/fixture.json','utf8'));
if(fixture.synthetic!==true)throw Error('Se requieren datos artificiales comprobados');

async function search(page:Page){
 await page.getByLabel('Buscar actores').fill(fixture.search);
 await expect(page.getByText('363 resultados con los filtros actuales',{exact:true})).toBeVisible({timeout:30000});
}
async function chooseState(page:Page,label:string){
 await page.getByLabel('Estado',{exact:true}).click();
 await page.getByRole('option',{name:label,exact:true}).click();
}
async function readDownload(page:Page){
 const waiting=page.waitForEvent('download');
 await page.getByText('Exportar',{exact:true}).click();
 await page.getByRole('button',{name:'CSV de esta página',exact:true}).click();
 const stream=await(await waiting).createReadStream(),chunks:Buffer[]=[];
 for await(const chunk of stream)chunks.push(Buffer.from(chunk));
 return Buffer.concat(chunks).toString('utf8');
}
test('the complete directory, filters, page export and fiche return agree',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await login(page,info,'admin');await page.goto(prefix(info)+'/admin/actores');await search(page);
 await page.getByRole('button',{name:'Página 19',exact:true}).click();
 await expect(page.getByRole('button',{name:'Vista rápida de QA DIR31 120 generador',exact:true})).toBeVisible();
 await expect(page.locator('body')).toContainText(/Mostrando\s*361-363\s*de\s*363/);
 const csv=await readDownload(page);
 expect(csv).toContain('Página 19 de 19');expect(csv).toContain('# Total registros: 3');
 expect(csv).toContain('QA DIR31 120 generador');expect(csv).toContain('QA DIR31 120 transportista');
 expect(csv).toContain('QA DIR31 120 operador');expect(csv).not.toContain('QA DIR31 119');
 await page.getByRole('button',{name:'Vista rápida de QA DIR31 120 generador',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Detalle del Actor'});
 await dialog.getByRole('button',{name:'Ver detalle completo',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/actores\/generadores\/qa-overview31-generador-120/);
 await page.getByRole('button',{name:'Volver a Actores',exact:true}).click();
 await expect(page.getByLabel('Buscar actores')).toHaveValue(fixture.search);
 await expect(page.getByRole('button',{name:'Página 19',exact:true})).toHaveAttribute('aria-current','page');
 await chooseState(page,'Inactivos');
 await expect(page.getByText('93 resultados con los filtros actuales',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:/Generadores/}).click();
 await expect(page.getByText('31 resultados con los filtros actuales',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Página 2',exact:true}).click();
 await expect(page.getByRole('button',{name:'Vista rápida de QA DIR31 120 generador',exact:true})).toBeVisible();
 await expect(page.locator('body')).toContainText(/Mostrando\s*21-31\s*de\s*31/);
 const widths=[];
 for(const width of [320,393,768,1365,1920]){
  await page.setViewportSize({width,height:900});await readablePageHeading(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  widths.push(width);
 }
 await page.setViewportSize(info.project.name==='app'?{width:320,height:800}:{width:1365,height:900});
 await page.screenshot({path:info.outputPath('overview.png'),fullPage:true,animations:'disabled'});
 expect(errors).toEqual([]);
 writeFileSync(info.outputPath('proof.json'),JSON.stringify({synthetic:true,surface:info.project.name,total:363,lastPage:3,inactiveGeneradores:31,downloadRows:3,returnPreserved:true,widths}));
});

test('inspection staff can consult the directory without creation or deletion',async({page},info)=>{
 await login(page,info,'inspector');await page.goto(prefix(info)+'/actores');await search(page);
 await expect(page.getByRole('button',{name:'Nuevo Actor'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^Eliminar QA DIR31/})).toHaveCount(0);
 await page.getByRole('button',{name:'Página 19',exact:true}).click();
 await expect(page.getByRole('button',{name:'Vista rápida de QA DIR31 120 operador',exact:true})).toBeVisible();
});

test('a failed lookup is not presented as an empty directory and can be retried',async({page},info)=>{
 await login(page,info,'admin');await page.goto(prefix(info)+'/admin/actores');await search(page);
 const url='**/api/actores/directorio**';
 const fail=async(route:any)=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"QA sin conexión"}'});
 await page.route(url,fail);await page.reload();
 await expect(page.getByRole('alert')).toContainText('No pudimos consultar el padrón',{timeout:20000});
 await expect(page.getByText('No se encontraron actores')).toHaveCount(0);
 await page.getByText('Exportar',{exact:true}).click();
 await expect(page.getByRole('button',{name:'CSV de esta página'})).toBeDisabled();
 await page.unroute(url,fail);
 await page.getByRole('button',{name:'Reintentar consulta'}).click();
 await expect(page.getByText('363 resultados con los filtros actuales',{exact:true})).toBeVisible();
});

test('new actor opens each full form and returns to the same overview without submitting',async({page},info)=>{
 const actorPosts:string[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(request.method()==='POST'&&/^\/api\/actores\/(generadores|transportistas|operadores)$/.test(url.pathname))actorPosts.push(url.pathname)});
 await login(page,info,'admin');await page.goto(prefix(info)+'/admin/actores');await search(page);
 await chooseState(page,'Inactivos');await page.getByRole('tab',{name:/Generadores/}).click();
 await expect(page.getByText('31 resultados con los filtros actuales',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Página 2',exact:true}).click();
 for(const [label,kind] of [['Generador','generadores'],['Transportista','transportistas'],['Operador','operadores']]){
  await page.getByRole('button',{name:'Nuevo Actor',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Nuevo Actor'});
  await dialog.getByLabel('Tipo de Actor').click();await page.getByRole('option',{name:label,exact:true}).click();
  await dialog.getByRole('button',{name:'Continuar al formulario'}).click();
  await expect(page).toHaveURL(new RegExp('/admin/actores/'+kind+'/nuevo$'));
  await expect(page.getByRole('button',{name:'Volver a Actores',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Volver a Actores',exact:true}).click();
  await expect(page.getByLabel('Buscar actores')).toHaveValue(fixture.search);
  await expect(page.getByRole('button',{name:'Página 2',exact:true})).toHaveAttribute('aria-current','page');
 }
 expect(actorPosts).toEqual([]);
});
