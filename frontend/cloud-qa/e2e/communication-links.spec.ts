import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isolatedMapTiles, login, prefix } from './helpers';
const f = JSON.parse(readFileSync(process.env.QA_ARTIFACTS! + '/fixture.json', 'utf8'));
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');

async function enterAfterMail(page: any) {
  await expect(page).toHaveURL(/\/login$/); await page.reload();
  await page.getByLabel('Correo electrónico o CUIT').fill('generador@night-qa.invalid');
  await page.getByLabel('Contraseña', { exact: true }).fill('OnlyLocal-NightQA-2026!');
  const reply=page.waitForResponse((r:any)=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Ingresar',exact:true}).click();expect((await reply).status()).toBe(200);
  await expect(page.getByRole('banner')).toBeVisible();
  const welcome=page.getByRole('button',{name:'Saltar introducción',exact:true});if(await welcome.isVisible())await welcome.click();
}
for (const [index,item] of f.mails.entries()) test('real mail preserves target after login and reload: '+index,async({page},info)=>{
  await isolatedMapTiles(page,info);
  await page.context().addCookies([{name:'sitrep_qa_client',value:`127.22.${info.project.name==='app'?2:1}.${index+1}`,url:'http://127.0.0.1:4177'}]);
  await page.addInitScript(()=>localStorage.setItem('sitrep_onboarding_GENERADOR','true'));
  await page.setContent(item.html);
  const app=page.locator('[data-mail-action="app"]'), web=page.locator('[data-mail-action="web"]');
  await expect(app).toHaveCount(1);await expect(web).toHaveCount(1);
  const a=new URL((await app.getAttribute('href'))!),w=new URL((await web.getAttribute('href'))!);
  expect(a.pathname).toBe('/app'+w.pathname);expect(a.search+a.hash).toBe(w.search+w.hash);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('correo.png'),fullPage:true});
  const target=info.project.name==='app'?a:w;
  await (info.project.name==='app'?app:web).click();await enterAfterMail(page);
  await expect(page).toHaveURL(target.href);
  const metadata=JSON.parse(item.notice.datos||'{}');
  if(metadata.tipo==='comprobante_repetido' && metadata.solicitudId) {
    await expect(page.getByText('Tipo: GENERADOR',{exact:true})).toBeVisible();
  } else if(metadata.tipo==='adenda_manifiesto') {
    await expect(page.getByRole('region',{name:'Adenda qa-mail-copy-adenda',exact:true})).toBeVisible();
    await expect(page.getByText('QA decisión individual').first()).toBeVisible();
  } else if(metadata.tipo === 'soporte') {
    await expect(page.getByText('QA comunicación resuelta',{exact:false}).first()).toBeVisible();
    await expect(page.getByText('QA solución documentada',{exact:false}).first()).toBeVisible();
  } else if(metadata.tipo === 'intercambio_inspeccion') {
    await expect(page.getByText('QA documentación requerida',{exact:false}).first()).toBeVisible();
    await expect(page.getByTestId('inspection-deadline-value')).toBeVisible();
    await expect(page.getByTestId('inspection-deadline-value')).not.toContainText('Sin plazo');
  } else if(target.pathname.includes('/notificaciones/')) await expect(page.getByRole('heading',{name:item.notice.titulo,exact:true})).toBeVisible();
  else await expect(page.getByText(metadata.tipo==='recordatorio_firma'?'QA-LINKS-FIRMA':'QA-CORREOS-0001',{exact:false}).first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('destino.png'),animations:'disabled'});
});
for (const [index,item] of f.mails.entries()) test('preferred mail action preserves target after login: '+index,async({page},info)=>{
  await isolatedMapTiles(page,info);
  await page.context().addCookies([{name:'sitrep_qa_client',value:`127.23.${info.project.name==='app'?2:1}.${index+1}`,url:'http://127.0.0.1:4177'}]);
  await page.setContent(item.html);
  const primary=page.locator('[data-mail-action="preferred"]');await expect(primary).toHaveCount(1);
  const direct=new URL((await page.locator('[data-mail-action="web"]').getAttribute('href'))!);
  const target=direct.origin+(info.project.use.hasTouch?'/app':'')+direct.pathname+direct.search+direct.hash;
  await primary.click();await enterAfterMail(page);await expect(page).toHaveURL(target);
  await expect(page.getByRole('banner')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('preferencia-destino.png'),animations:'disabled'});
});
test('old individual notice is private, read-only and independent of the inbox page',async({page},info)=>{
  const db=new PrismaClient();let id='';
  try{
    expect(new URL(process.env.DATABASE_URL!).searchParams.get('schema')).toBe('communication_links_20261022');
    const notice=await db.notificacion.create({data:{usuarioId:f.users.generador,tipo:'ALERTA_SISTEMA',titulo:'QA aviso antiguo '+info.project.name,mensaje:'QA revisar mi ficha',datos:'{"ruta":"/mi-perfil"}',createdAt:new Date('2020-01-01')}});id=notice.id;
    await login(page,info,'generador');await page.goto(prefix(info)+'/notificaciones/'+id);
    await expect(page.getByRole('heading',{name:notice.titulo,exact:true})).toBeVisible();
    expect((await db.notificacion.findUniqueOrThrow({where:{id}})).leida).toBe(false);
    await page.getByRole('link',{name:/Abrir mi ficha/}).click();await expect(page).toHaveURL(new RegExp('/mi-perfil$'));
    // A second person uses an independent authenticated browser session.
    // App login correctly redirects an already signed-in person to their dashboard.
    const otherContext=await page.context().browser()!.newContext({baseURL:'http://127.0.0.1:4177',viewport:info.project.use.viewport,userAgent:info.project.use.userAgent,isMobile:info.project.use.isMobile,hasTouch:info.project.use.hasTouch});
    try {
      const other=await otherContext.newPage();
      await login(other,info,'operador');await other.goto(prefix(info)+'/notificaciones/'+id);
      await expect(other.getByRole('alert')).toContainText('cuenta que recibió el correo');
      await expect(other.getByText(notice.titulo,{exact:true})).toHaveCount(0);
    } finally { await otherContext.close(); }
  }finally{await db.$disconnect();}
});
test('bell resolves the selected addendum even after more than twenty newer records',async({page},info)=>{
  const db=new PrismaClient();
  try{
    expect(new URL(process.env.DATABASE_URL!).searchParams.get('schema')).toBe('communication_links_20261022');
    const oldest=await db.adendaManifiesto.findUniqueOrThrow({where:{id:'qa-mail-copy-adenda'}});
    if(await db.adendaManifiesto.count({where:{manifiestoId:f.manifestId}})<22)await db.adendaManifiesto.createMany({data:Array.from({length:21},(_,i)=>({...oldest,id:'qa-links-newer-'+i,huellaSolicitud:'new-'+i,createdAt:new Date(Date.now()+1000+i),revisiones:[],motivo:'QA adenda posterior '+i}))});
    const notice=f.mails.find((m:any)=>JSON.parse(m.notice.datos||'{}').tipo==='adenda_manifiesto').notice;
    await login(page,info,'generador');await page.goto(prefix(info)+'/notificaciones/'+notice.id);
    await page.getByRole('link',{name:/Abrir adenda y revisiones/}).click();
    await expect(page).toHaveURL(new RegExp('adendas\\?adenda=qa-mail-copy-adenda$'));
    await expect(page.getByRole('region',{name:'Adenda qa-mail-copy-adenda',exact:true})).toBeVisible();
    await expect(page.getByText('QA decisión individual').first()).toBeVisible();
    await page.getByRole('button',{name:'Ver todas las adendas',exact:true}).click();
    await expect(page).toHaveURL(new RegExp('/adendas$'));
    await expect(page.getByRole('navigation',{name:'Páginas de adendas'})).toBeVisible();
  }finally{await db.$disconnect();}
});
test('manual explains both surfaces, deadlines and closed delivery',async({page},info)=>{
  await isolatedMapTiles(page,info);await page.goto('/manual/tutorial.html?guide=avisos-enlaces-plazos');
  await expect(page.getByRole('heading',{name:'Abrir un correo o aviso y continuar el trámite',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('manual.png'),fullPage:true});
});
