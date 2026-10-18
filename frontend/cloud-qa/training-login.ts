import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { login, isolatedMapTiles, prefix } from './e2e/helpers';
export const publishedTraining = process.env.QA_TRAINING_PUBLISHED === 'true';
export type TrainingRehearsalRecords = { manifests: Set<string>; eventuals: Set<string> };

/** Real sign-in; the published rehearsal can only mutate new CAP 5 exercises. */
export async function trainingLogin(page: Page, info: TestInfo, shared?: TrainingRehearsalRecords) {
  if (!publishedTraining) return login(page, info);
  assert.equal(process.env.QA_TRAINING_PRODUCTION_AUTHORIZED, 'true');
  const credentials = JSON.parse(readFileSync(path.join(process.env.QA_ARTIFACTS!, 'teacher-private.json'), 'utf8'));
  assert.equal(credentials.email, 'qa.training.20261018@qa.invalid');
  assert.ok(credentials.password.length >= 40);
  const origin = 'https://sitrep.ultimamilla.com.ar';
  const { manifests, eventuals } = shared ?? { manifests: new Set<string>(), eventuals: new Set<string>() };
  await isolatedMapTiles(page, info);
  await page.addInitScript(() => {
    for (const role of ['ADMIN','GENERADOR','TRANSPORTISTA','OPERADOR','INSPECTOR']) localStorage.setItem('sitrep_onboarding_' + role, 'true');
  });
  page.on('response', async response => {
    const request = response.request();
    if (request.method() === 'POST' && response.status() === 201 && response.url() === origin + '/api/manifiestos') {
      const value = (await response.json()).data.manifiesto; if (typeof value.id === 'string') manifests.add(value.id);
    }
  });
  await page.route(origin + '/api/**', async route => {
    const r = route.request(), p = new URL(r.url()).pathname, method = r.method(), read = ['GET','HEAD','OPTIONS'].includes(method);
    let body: any; try { body = r.postDataJSON(); } catch { body = {}; }
    let c: any = {}; try { c = JSON.parse(Buffer.from((r.headers().authorization || '').replace(/^Bearer /,'').split('.')[1], 'base64url').toString()); } catch { /* unauthenticated */ }
    let allowed = read && ['/api/health','/api/auth/profile','/api/auth/roles','/api/push/vapid-key'].includes(p);
    if (method === 'POST' && p === '/api/auth/login') allowed = body?.email === credentials.email;
    if (method === 'POST' && ['/api/auth/logout','/api/auth/refresh-token'].includes(p)) allowed = true;
    if (c.id === credentials.id && !c.realm && !c.impersonatedBy) {
      allowed ||= read && ['/api/admin/training/usuarios','/api/notificaciones'].includes(p);
      allowed ||= method === 'POST' && /^\/api\/admin\/training\/impersonate\/cap-20261012-(generador|transportista|operador|admin)-5$/.test(p);
    }
    if (c.realm === 'sitrep-capacitacion-v1' && c.impersonatedBy === credentials.id && /^cap-20261012-(generador|transportista|operador|admin)-5$/.test(c.id || '')) {
      allowed ||= read && /^\/api\/(manifiestos|catalogos|actores|reportes|analytics|centro-control|inspecciones|soporte|notificaciones|search|admin\/usuarios|solicitudes|renovaciones|alertas|anomalias)(\/|$)/.test(p);
      if (method === 'POST' && p === '/api/manifiestos') allowed = c.id === 'cap-20261012-generador-5' && body?.generadorId === credentials.generadorId && body?.transportistaId === credentials.transportistaId && body?.operadorId === credentials.operadorId;
      if (method === 'POST' && p === '/api/manifiestos/baja-intensidad') {
        allowed = c.id === 'cap-20261012-generador-5' && body?.operador?.padronId === credentials.operadorId && !body?.transportista?.padronId && typeof body?.id === 'string';
        if (allowed) eventuals.add(body.id);
      }
      if (method === 'POST') allowed ||= [...manifests].some(id => new RegExp('^/api/manifiestos/' + id + '/(firmar|confirmar-retiro|confirmar-entrega|confirmar-recepcion|pesaje|tratamiento|cerrar|ubicacion|adendas(?:/[^/]+/revisiones)?)$').test(p))
        || [...eventuals].some(id => p === '/api/manifiestos/baja-intensidad/' + id + '/eventos');
    }
    if (!allowed) { info.annotations.push({type:'blocked-operational-request',description:method+' '+p}); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  await page.goto(prefix(info) + '/login');
  await page.getByLabel('Correo electrónico o CUIT').fill(credentials.email);
  await page.getByLabel('Contraseña', {exact:true}).fill(credentials.password);
  const signed = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', {name:'Ingresar',exact:true}).click(); expect((await signed).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
}
