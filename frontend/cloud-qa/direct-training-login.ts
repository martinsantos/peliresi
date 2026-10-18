import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { isolatedMapTiles, prefix } from './e2e/helpers';
import type { TrainingRehearsalRecords } from './training-login';

export async function directTrainingLogin(page: Page, info: TestInfo, role: string, records: TrainingRehearsalRecords) {
  const published = process.env.QA_TRAINING_PUBLISHED === 'true';
  if (published) assert.equal(process.env.QA_TRAINING_PRODUCTION_AUTHORIZED, 'true');
  const credentials = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'direct-private.json'), 'utf8'));
  const account = credentials.accounts.find((a: any) => a.role === role);
  assert.ok(account && account.email.endsWith('@capacitacion.invalid'));
  const origin = published ? 'https://sitrep.ultimamilla.com.ar' : 'http://127.0.0.1:4177';
  await isolatedMapTiles(page, info);
  const ownNotices=new Set<string>();
  await page.on('response', async response => {
    if (response.request().method()==='GET' && new URL(response.url()).pathname==='/api/notificaciones' && response.status()===200) {
      for(const notice of (await response.json()).data.notificaciones||[]) if(records.manifests.has(notice.manifiestoId))ownNotices.add(notice.id);
    }
    if (response.request().method() === 'POST' && response.status() === 201 && response.url() === origin + '/api/manifiestos') {
      const value = (await response.json()).data.manifiesto; if (typeof value.id === 'string') records.manifests.add(value.id);
    }
  });
  await page.route(origin + '/api/**', async route => {
    const request=route.request(),p=new URL(request.url()).pathname,method=request.method(),read=['GET','HEAD','OPTIONS'].includes(method);
    let body:any;try{body=request.postDataJSON();}catch{body={};}
    let claim:any={};try{claim=JSON.parse(Buffer.from((request.headers().authorization||'').replace(/^Bearer /,'').split('.')[1],'base64url').toString());}catch{}
    let allowed=read&&['/api/health','/api/auth/roles','/api/push/vapid-key'].includes(p);
    if(method==='POST'&&p==='/api/auth/login')allowed=body?.email===account.email;
    if(method==='POST'&&p==='/api/auth/refresh-token') {
      try{const refresh=JSON.parse(Buffer.from(body.refreshToken.split('.')[1],'base64url').toString());allowed=refresh.realm==='sitrep-capacitacion-v1'&&refresh.trainingDirect===true&&refresh.id===account.id;}catch{allowed=false;}
    }
    if(claim.realm==='sitrep-capacitacion-v1'&&claim.trainingDirect===true&&!claim.impersonatedBy&&claim.id===account.id){
      allowed ||= read&&/^\/api\/(auth\/profile|manifiestos|catalogos|actores|reportes|analytics|centro-control|inspecciones|soporte|notificaciones|search|admin\/usuarios|solicitudes|renovaciones|alertas|anomalias)(\/|$)/.test(p);
      if(method==='POST'&&p==='/api/manifiestos')allowed=['generador','transportista','operador','admin'].includes(role)&&body?.generadorId===credentials.generadorId&&body?.transportistaId===credentials.transportistaId&&body?.operadorId===credentials.operadorId;
      if(method==='POST' && p==='/api/manifiestos/baja-intensidad') {
        allowed=role==='generador' && body?.operador?.padronId===credentials.operadorId && !body?.transportista?.padronId && typeof body?.id==='string';
        if(allowed)records.eventuals.add(body.id);
      }
      if(method==='POST' && [...records.eventuals].some(id=>p==='/api/manifiestos/baja-intensidad/'+id+'/eventos'))allowed=true;
      if(method==='POST')allowed ||= [...records.manifests].some(id=>new RegExp('^/api/manifiestos/'+id+'/(adendas(?:/[0-9a-f-]+/revisiones)?|aprobar-parte|documentos-cap|firmar|confirmar-retiro|confirmar-entrega|confirmar-recepcion|pesaje|tratamiento|cerrar|ubicacion)$').test(p))||p==='/api/auth/logout';
    }
    if(method==='PUT' && claim.realm==='sitrep-capacitacion-v1' && claim.id===account.id && [...ownNotices].some(id=>p==='/api/notificaciones/'+id+'/leida'))allowed=true;
    if(!allowed){info.annotations.push({type:'blocked-non-classroom-request',description:method+' '+p});return route.abort('blockedbyclient');}
    return route.continue();
  });
  await page.goto(prefix(info)+'/login');
  await page.getByLabel('Correo electrónico o CUIT').fill(account.email);
  await page.getByLabel('Contraseña',{exact:true}).fill(account.password);
  const signed=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Ingresar',exact:true}).click();
  const response=await signed;expect(response.status()).toBe(200);expect(response.headers()['x-sitrep-training']).toBe('true');
  const result=await response.json();expect(result.data.user.id).toBe(account.id);expect(result.data.user.training).toBe(true);
  await expect(page).not.toHaveURL(/\/login$/);
  // New participants see the existing welcome, then retain their own role.
  const dismiss=page.getByRole('button',{name:/^(Omitir|Saltar|Entendido|Comenzar|Cerrar tutorial)/});
  if(await dismiss.count())await dismiss.first().click();
  await expect(page.getByText('Capacitación · sin validez oficial',{exact:false}).first()).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('sitrep_impersonation'))).toBeNull();
}
