import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_REPOSITORY, 'martinsantos/peliresi');
const origin = 'https://sitrep.ultimamilla.com.ar';
const output = '/tmp/sitrep-mail-production';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const checks: unknown[] = [], blockedWrites: string[] = [], warnings: string[] = [];
try {
  for (const [name, width, height, prefix] of [['desktop',1440,900,''],['responsive',360,800,''],['app',360,800,'/app']] as const) {
    const context = await browser.newContext({ viewport: {width,height}, serviceWorkers: 'block' });
    const errors: string[] = [], failedAssets: string[] = [];
    // Guard, not a mocked successful API: no POST/PUT/DELETE may reach production.
    await context.route('**/*', async (route: any) => {
      if (new URL(route.request().url()).origin === origin && !['GET','HEAD','OPTIONS'].includes(route.request().method())) {
        blockedWrites.push(route.request().method()+' '+new URL(route.request().url()).pathname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror',(error: Error)=>errors.push(error.message));
    page.on('console',(message: any)=>{if(['warning','error'].includes(message.type()))warnings.push(name+': '+message.text());});
    page.on('response',(response: any)=>{const url=new URL(response.url());if(url.origin===origin&&(response.status()>=500||(response.status()>=400&&/\.(js|css|woff2|png|svg)$/.test(url.pathname))))failedAssets.push(response.status()+' '+url.pathname);});
    await page.goto(origin+prefix+'/login',{waitUntil:'networkidle'});
    assert.equal(new URL(page.url()).pathname,prefix+'/login');
    assert.match(await page.title(),/SITREP/i);
    await expect(page.getByRole('button',{name:'Ingresar',exact:true})).toBeVisible();
    const password=page.locator('input[type="password"]');await expect(password).toBeVisible();
    await page.getByRole('button',{name:'Mostrar contraseña',exact:true}).click();
    await expect(page.getByRole('button',{name:'Ocultar contraseña',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).click();
    await expect(password).toBeVisible();
    await page.screenshot({path:output+'/'+name+'-login.png',animations:'disabled'});
    for(const actor of ['Generador','Transportista','Operador']) {
      await page.goto(origin+prefix+'/login',{waitUntil:'networkidle'});
      await page.getByRole('link',{name:`Probar formulario de ${actor} sin completar datos`,exact:true}).click();
      await expect(page.getByRole('heading',{name:`Inscripción como ${actor}`,exact:true})).toBeVisible();
      await expect(page.getByTestId('registration-wizard')).toBeVisible();
      await expect(page.getByTestId('tef-calculator')).toHaveCount(0);
      const draft=page.getByRole('region',{name:'Borrador de prueba',exact:true});
      const help=draft.getByRole('button',{name:'Información del modo prueba',exact:true});
      await help.click();await expect(draft.getByRole('note')).toContainText('No crea cuentas, trámites ni avisos');
      await help.click();await expect(draft.getByRole('note')).toHaveCount(0);
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
      await page.screenshot({path:output+'/'+name+'-'+actor.toLowerCase()+'.png',animations:'disabled'});
      checks.push({viewport:name,actor,route:new URL(page.url()).pathname,formRendered:true,helpToggle:true,noTEF:true,noHorizontalOverflow:true});
    }
    await page.goto(origin+prefix+'/mi-perfil',{waitUntil:'networkidle'});
    await expect(page).toHaveURL(new RegExp(prefix+'/login$'));
    assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);
    checks.push({viewport:name,loginPasswordToggle:true,protectedRouteRedirect:true,runtimeErrors:0,failedAssets:0});
    await context.close();
  }
  writeFileSync(output+'/result.json',JSON.stringify({passed:true,at:new Date().toISOString(),origin,checks,blockedWrites,warnings,authenticated:false,businessDataWritten:false,localBrowser:false},null,2));
} catch(error) {
  writeFileSync(output+'/failure.json',JSON.stringify({error:String(error),checks,blockedWrites,warnings},null,2));throw error;
} finally {await browser.close();}
