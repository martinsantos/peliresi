import {test,expect} from '@playwright/test';
import {isolatedMapTiles} from './helpers';

test('four-phone guide opens from home, preserves Web/App links and has a usable mobile index',async({page},info)=>{
  await isolatedMapTiles(page,info);const errors:string[]=[],api:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.method()+' '+r.url());});
  await page.goto('/manual/');
  await page.getByRole('link',{name:'Un manifiesto, cuatro teléfonos',exact:true}).first().click();
  await expect(page).toHaveTitle('Un manifiesto, cuatro teléfonos — Centro de Ayuda SITREP');
  await expect(page.locator('#tutorialTitle')).toHaveText('Un manifiesto, cuatro teléfonos');
  await expect(page.locator('.guide-step')).toHaveCount(7);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('#safetyNote')).toContainText('No se necesita la cuenta administradora personal');
  const preparation=page.locator('.guide-step').first();
  await expect(preparation.locator('a[href="/login"]')).toHaveAttribute('target','_blank');
  await expect(preparation.locator('a[href="/app/login"]')).toHaveAttribute('rel','noopener');
  await page.screenshot({path:info.outputPath('four-phones-guide-first.png'),animations:'disabled'});
  if(info.project.name!=='web-desktop')await page.getByRole('button',{name:/Índice del tutorial/}).click();
  await page.getByRole('navigation',{name:'Pasos de la guía'}).getByRole('link',{name:/Ver el mismo viaje/}).click();
  const heading=page.getByRole('heading',{name:'Ver el mismo viaje · teléfono del administrador',exact:true});
  await expect(heading).toBeInViewport({ratio:1});
  await expect(page).toHaveURL(/#paso-4-ver-el-mismo-viaje-telefono-del-administrador$/);
  await page.reload();await expect(heading).toBeInViewport({ratio:1});
  await expect(page.locator('#tutorialIndex a[aria-current="step"]')).toContainText('Ver el mismo viaje');
  for(const image of await page.locator('img.guide-image').all()){
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath('four-phones-guide-c3.png'),animations:'disabled'});
  await page.goto('/manual/search.html?q=cuatro%20tel%C3%A9fonos');
  await expect(page.getByRole('link',{name:/Un manifiesto, cuatro teléfonos/}).first()).toBeVisible();
  expect(api).toEqual([]);expect(errors).toEqual([]);
});
