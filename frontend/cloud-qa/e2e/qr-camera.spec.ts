import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { login } from './helpers';

test('camera fixture is decoded by real jsQR and opens the exact synthetic manifest',async({page,context},info)=>{
  const fixture=JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!,'fixture.json'),'utf8'));
  expect(fixture.database).toBe('sitrep_night_qa_20260926');
  const runtimeErrors:string[]=[];page.on('pageerror',error=>runtimeErrors.push(error.message));
  await login(page,info);
  await context.grantPermissions(['camera','geolocation']);
  await page.goto(info.project.name==='app'?'/app/escaner-qr':'/mobile/escaner-qr');
  await expect(page.getByRole('heading',{name:'Resultado del escaneo'})).toBeVisible();
  await expect(page.getByText(fixture.deviceManifest.id,{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('real-qr-decoded.png')});
  await page.getByRole('button',{name:'Ver Manifiesto',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/manifiestos/'+fixture.deviceManifest.id+'$'));
  await expect(page.getByRole('button',{name:'Descargar PDF',exact:true})).toBeVisible();
  await expect(page.locator('body')).toContainText(fixture.deviceManifest.numero);
  expect(runtimeErrors).toEqual([]);
  await info.attach('camera-scope',{body:JSON.stringify({opticalInput:'synthetic Y4M, actual PDF payload format',decoder:'real jsQR',api:'real isolated backend',physicalCameraTested:false}),contentType:'application/json'});
});
