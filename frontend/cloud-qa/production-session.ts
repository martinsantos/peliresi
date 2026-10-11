import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { assertCloudEnvironment } from './safety.ts';
import { apkCredentials, apkOrigin, apkRequestAllowed } from './apk-auth-policy.ts';

assertCloudEnvironment();
const account = apkCredentials(process.env.QA_APK_CREDENTIALS);
delete process.env.QA_APK_CREDENTIALS;
console.log('::add-mask::' + account.password);
const output = path.join(process.env.QA_ARTIFACTS!, 'production-session');
mkdirSync(output, { recursive: true });
const results: unknown[] = [];
const browser = await chromium.launch();
try {
  for (const [name, width, prefix] of [['desktop',1440,''],['responsive',360,''],['app',360,'/app']] as const) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const errors: string[] = [], blocked: string[] = [];
    await context.route(apkOrigin + '/api/**', async route => {
      const request = route.request();
      if (!apkRequestAllowed(request.url(), request.method(), request.postData(), true)) {
        blocked.push(request.method()+' '+new URL(request.url()).pathname);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(apkOrigin+prefix+'/login');
    await expect(page).toHaveTitle(/SITREP/);
    await page.getByLabel('Correo electrónico o CUIT').fill(account.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
    const loggedIn = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/login');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    const response = await loggedIn;
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.data.user.id, account.id);
    for (const actor of ['generador','operador','transportista']) assert.equal(body.data.user[actor], null);
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.getByRole('banner')).toBeVisible();
    const intro = page.getByRole('button', {name:'Saltar introducción', exact:true});
    await expect(intro).toBeVisible();
    await intro.click();
    await expect(intro).toHaveCount(0);
    await page.screenshot({path:path.join(output,name+'-dashboard.png')});
    const listing = page.waitForResponse(response => new URL(response.url()).pathname === '/api/manifiestos');
    await page.goto(apkOrigin+prefix+'/manifiestos');
    const manifests = await listing;
    assert.equal(manifests.status(),200);
    assert.deepEqual((await manifests.json()).data.manifiestos,[]);
    await expect(page.getByText('No se encontraron manifiestos',{exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByText('No se encontraron manifiestos',{exact:true})).toBeVisible();
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);
    await page.screenshot({path:path.join(output,name+'-manifests.png')});
    if (prefix) {
      await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
      await page.getByRole('button',{name:'Cerrar Sesión',exact:true}).click();
    } else {
      if (width<1024) await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
      await page.getByRole('button',{name:/Mi Cuenta/}).click();
      await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
    }
    await expect(page).toHaveURL(new RegExp(prefix+'/login$'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('sitrep_access_token')),null);
    await page.goto(apkOrigin+prefix+'/manifiestos');
    await expect(page).toHaveURL(new RegExp(prefix+'/login$'));
    assert.deepEqual(errors,[]); assert.deepEqual(blocked,[]);
    results.push({name,login:true,ownIdentity:true,emptyOwnList:true,reload:true,logout:true,protectedRedirect:true,pageErrors:errors,blocked});
    await context.close();
  }
  writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,at:new Date().toISOString(),results,businessWrites:0,scope:'Temporary GENERADOR without actor; not all business roles'},null,2));
} catch(error) {
  writeFileSync(path.join(output,'failure.json'),JSON.stringify({results,error:String(error).replaceAll(account.password,'[REDACTED]')},null,2));
  process.exitCode=1;
} finally { await browser.close(); }
