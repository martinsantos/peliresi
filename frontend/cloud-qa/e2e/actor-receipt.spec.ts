import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from '../safety';
import { isolatedMapTiles, login, prefix } from './helpers';

const fixture = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'fixture.json'), 'utf8'));
test.beforeAll(async () => { await assertCloudDatabase(); expect(fixture.synthetic).toBe(true); });
const labels: Record<string, string> = { generador:'Generador', transportista:'Transportista', operador:'Operador' };
async function openReceipt(page: Page, info: TestInfo, type: string) {
  const item = fixture.created[type], role = labels[type];
  await expect(page).toHaveURL(new RegExp(`/notificaciones/${item.notice}$`));
  await expect(page.getByRole('heading', { name:'Comprobante repetido', exact:true })).toBeVisible();
  if (type !== 'generador') {
    await expect(page.getByText(`Usá tu actividad ${role} para consultar este comprobante.`, { exact:true })).toBeVisible();
    await page.getByRole('button', { name:`Usar ${role} y ver comprobante`, exact:true }).click();
  } else {
    await page.getByRole('link', { name:'Revisar comprobante →', exact:true }).click();
  }
  await expect(page).toHaveURL(`http://127.0.0.1:4177${prefix(info)}/mi-perfil?comprobante=${item.document}&aviso=${item.notice}#comprobante-aviso`);
  const card = page.getByRole('region', { name:'Comprobante del aviso' });
  await expect(card).toBeVisible(); await expect(card).toContainText(item.documentName);
  await expect(card).toContainText(`Actividad: ${role}`); await expect(card).toContainText('no acredita un pago nuevo');
  await expect(card.getByRole('link',{name:'Volver al aviso'})).toHaveAttribute('href',`${prefix(info)}/notificaciones/${item.notice}`);
  await expect(card).toBeFocused();
  await page.screenshot({ path:info.outputPath('comprobante.png'), animations:'disabled' });
  return card;
}
for (const source of ['campana','avisos'] as const) {
  test(`${source} abre el aviso del operador y permite activar su ficha`, async ({page},info) => {
    await login(page, info, fixture.owner.split('@')[0]);
    if (source === 'campana') {
      await page.getByRole('button',{name:/^Notificaciones/}).click();
      await page.getByRole('region',{name:'Notificaciones recientes'}).getByRole('button').filter({hasText:'Comprobante repetido'}).first().click();
    } else {
      await page.goto(`${prefix(info)}/notificaciones`);
      await page.getByRole('button',{name:'Abrir aviso: Comprobante repetido',exact:true}).first().click();
    }
    const card=await openReceipt(page,info,'operador');
    await card.getByRole('link',{name:'Volver al aviso'}).click();
    await expect(page).toHaveURL(new RegExp(`/notificaciones/${fixture.created.operador.notice}$`));
    await expect(page.getByRole('heading',{name:'Comprobante repetido',exact:true})).toBeVisible();
  });
}
for (const type of ['generador','transportista','operador'] as const) {
  test(`correo del comprobante de ${type} conserva ficha y documento tras ingresar`, async ({page},info) => {
    await isolatedMapTiles(page,info);
    await page.context().addCookies([{name:'sitrep_qa_client',value:`127.25.${type === 'generador' ? 81 : type === 'transportista' ? 82 : 83}.${info.project.name === 'app' ? 2 : 1}`,url:'http://127.0.0.1:4177'}]);
    await page.setContent(fixture.created[type].mailHtml);
    const link=page.locator(`[data-mail-action="${info.project.name === 'app' ? 'app' : 'web'}"]`);
    await link.click(); await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Correo electrónico o CUIT').fill(fixture.owner);
    await page.getByLabel('Contraseña',{exact:true}).fill('OnlyLocal-NightQA-2026!');
    const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Ingresar',exact:true}).click(); expect((await response).status()).toBe(200);
    await expect(page.getByRole('dialog',{name:'Bienvenido a SITREP'})).toHaveCount(0);
    const downloads: string[] = [];
    page.on('request',request=>{if(request.url().includes('/download')) downloads.push(request.url());});
    const card=await openReceipt(page,info,type);expect(downloads).toEqual([]);
    const download=page.waitForEvent('download');
    await card.getByRole('button',{name:'Descargar comprobante',exact:true}).click();
    expect((await download).suggestedFilename()).toBe(fixture.created[type].documentName);
  });
}
test('otra cuenta no puede ver ni descargar el comprobante',async({page},info)=>{
  await login(page,info,fixture.outsider.split('@')[0]);
  const item=fixture.created.operador;
  const status=await page.evaluate(async ({id,notice})=>{
    const token=localStorage.getItem('sitrep_access_token');
    const headers={Authorization:'Bearer '+token};
    const download=await fetch('/api/actores/documentos/'+encodeURIComponent(id)+'/download',{headers});
    const detail=await fetch('/api/notificaciones/'+encodeURIComponent(notice),{headers});
    return {download:download.status,notice:detail.status};
  },{id:item.document,notice:item.notice});
  expect(status).toEqual({download:403,notice:404});
  await page.goto(`${prefix(info)}/mi-perfil?comprobante=${item.document}#comprobante-aviso`);
  const card=page.getByRole('region',{name:'Comprobante del aviso'});
  await expect(card).toContainText('El comprobante del aviso no está disponible en esta ficha');
  await expect(card).not.toContainText(item.documentName);
  await expect(card.getByRole('button',{name:'Descargar comprobante'})).toHaveCount(0);
});
test('a 320 px el comprobante y su acción permanecen visibles',async({page},info)=>{
  await page.setViewportSize({width:320,height:568}); await login(page,info,fixture.owner.split('@')[0]);
  await page.goto(`${prefix(info)}/notificaciones/${fixture.created.operador.notice}`);
  const card=await openReceipt(page,info,'operador');
  for(const part of [card.getByText('Actividad: Operador'),card.getByRole('button',{name:'Descargar comprobante'})]){
    await expect(part).toBeInViewport();
    expect(await part.evaluate(el=>{const r=el.getBoundingClientRect(), top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&!!top&&(top===el||el.contains(top));})).toBe(true);
  }
  await page.screenshot({path:info.outputPath('comprobante-320.png'),animations:'disabled'});
});
