import { test, expect } from '@playwright/test';
import { login, prefix } from './helpers';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../backend/package.json',import.meta.url));
const { PrismaClient } = require('@prisma/client');

test('report rows, sorting, filters, exports and real actor destinations remain usable', async ({page},info)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
  await login(page,info);
  const received=page.waitForResponse(r=>r.url().includes('/api/reportes/manifiestos')&&r.status()===200);
  await page.goto(prefix(info)+'/reportes');
  const actual=(await(await received).json()).data;
  expect(actual.manifiestos.length).toBeGreaterThan(0);
  await expect(page.getByLabel('Desde',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Hasta',{exact:true})).toBeVisible();
  const toolbar=page.getByRole('navigation',{name:'Tipos de reporte'});
  await expect(toolbar.getByRole('button',{name:'Manifiestos',exact:true})).toHaveAttribute('aria-pressed','true');
  const csvButton=page.getByRole('button',{name:'Exportar CSV',exact:true});
  const pdfButton=page.getByRole('button',{name:'Exportar PDF',exact:true}).first();
  await expect(csvButton.getByText('CSV',{exact:true})).toBeVisible();
  await expect(pdfButton.getByText('PDF',{exact:true})).toBeVisible();
  for(const control of [page.getByLabel('Desde',{exact:true}),page.getByLabel('Hasta',{exact:true}),csvButton,pdfButton]){
    const box=(await control.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await expect(page.getByRole('heading',{name:/^Detalle de Manifiestos/})).toBeVisible();
  await page.screenshot({path:info.outputPath('reports-toolbar.png'),animations:'disabled'});
  if(info.project.name!=='web-desktop'){
    const heading=page.getByRole('heading',{name:/^Detalle de Manifiestos/});
    await expect(heading.locator('xpath=../../..')).toHaveCSS('flex-direction','column');
    expect((await heading.boundingBox())!.width).toBeGreaterThan(220);
  }
  const table=page.getByRole('table');
  await expect(table.locator('tbody tr')).toHaveCount(actual.manifiestos.length);
  const sort=table.getByRole('button',{name:'Ordenar por Número',exact:true});
  await sort.click(); await expect(sort.locator('..')).toHaveAttribute('aria-sort','ascending');
  await sort.click(); await expect(sort.locator('..')).toHaveAttribute('aria-sort','descending');
  const csv=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
  const download=await csv;expect(await download.failure()).toBeNull();await download.saveAs(info.outputPath('report-manifiestos.csv'));
  const pdf=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar PDF',exact:true}).first().click();
  const pdfFile=await pdf;expect(await pdfFile.failure()).toBeNull();await pdfFile.saveAs(info.outputPath('report-manifiestos.pdf'));
  const row=table.locator('tbody tr').first(), number=(await row.locator('td').first().innerText()).trim();
  const record=actual.manifiestos.find((m:{numero:string})=>m.numero===number);expect(record.id).toBeTruthy();
  if(info.project.name==='web-desktop'){
    const bounds=await row.boundingBox();await row.hover();await expect(row).toHaveCSS('background-color','rgb(230, 247, 239)');expect(await row.boundingBox()).toEqual(bounds);
  }
  await row.focus();await expect(row).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath('reports-manifests.png'),animations:'disabled'});
  await row.press('Enter');await expect(page).toHaveURL(new RegExp(prefix(info)+'/manifiestos/'+record.id+'$'));
  await expect(page.getByText(record.numero,{exact:true}).first()).toBeVisible();
  await page.goBack();
  for(const [tab,category] of [['Generadores','generadores'],['Operadores','operadores'],['Transporte','transportistas']]){
    await toolbar.getByRole('button',{name:tab,exact:true}).click();
    const actorRow=page.getByRole('table').locator('tbody tr[tabindex="0"]').first();await expect(actorRow).toBeVisible();
    await actorRow.focus();await actorRow.press('Enter');
    await expect(page).toHaveURL(new RegExp(prefix(info)+'/admin/actores/'+category+'/[^/]+$'));
    await expect(page.getByRole('banner')).toBeVisible();
    if(category==='operadores'){
      await expect(page.getByText('Activo',{exact:true}).first()).toBeVisible();await expect(page.getByText('En línea',{exact:true})).toHaveCount(0);
    }
    await page.goBack();
  }
  await page.getByLabel('Desde',{exact:true}).fill('2099-01-01');await page.getByLabel('Hasta',{exact:true}).fill('2099-01-02');
  const filtered=page.waitForResponse(r=>r.url().includes('/api/centro-control/actividad')&&new URL(r.url()).searchParams.get('fechaDesde')==='2099-01-01'&&r.status()===200);
  await toolbar.getByRole('button',{name:'Generadores',exact:true}).click();
  const empty=(await(await filtered).json()).data;expect(empty.generadores).toHaveLength(0);expect(empty.operadores).toHaveLength(0);
  await expect(page.getByRole('table').locator('tbody tr[tabindex="0"]')).toHaveCount(0);
  await toolbar.getByRole('button',{name:'Operadores',exact:true}).click();
  await expect(page.getByRole('table').locator('tbody tr[tabindex="0"]')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('reports-empty-period.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});

test('general notice has real secondary actions without a fake opening destination',async({page},info)=>{
  const db=new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL!}}});
  let notice:{id:string;titulo:string};
  try{
    expect(await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address')).toEqual([{name:'sitrep_night_qa_20260926',port:55440,address:'127.0.0.1'}]);
    const admin=await db.usuario.findUniqueOrThrow({where:{email:'admin@night-qa.invalid'}});
    notice=await db.notificacion.create({data:{usuarioId:admin.id,tipo:'INFO_GENERAL',titulo:'[QA] Aviso general sin expediente '+info.project.name+' '+Date.now(),mensaje:'Aviso exclusivamente sintético. No contactar actores.'}});
  }finally{await db.$disconnect();}
  await login(page,info);await page.goto(prefix(info)+'/notificaciones');
  const title=page.getByText(notice.titulo,{exact:true});await expect(title).toBeVisible();
  const row=page.getByRole('list',{name:'Avisos',exact:true}).locator('li').filter({has:title});
  await expect(row.getByRole('button',{name:'Abrir aviso: '+notice.titulo,exact:true})).toHaveCount(0);
  await expect(row.locator('svg.lucide-chevron-right')).toHaveCount(0);
  if(info.project.name==='app')await expect(page.getByRole('banner')).toContainText('Avisos');
  const read=page.waitForResponse(r=>r.url().includes('/api/notificaciones/'+notice.id)&&r.request().method()==='PUT');
  await row.getByRole('button',{name:'Marcar como leída: '+notice.titulo,exact:true}).click();expect((await read).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(prefix(info)+'/notificaciones$'));
  await expect(row.getByText('Sin leer',{exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('general-notice.png'),animations:'disabled'});
});

test('report failure recovers without losing custom dates',async({page},info)=>{
  await login(page,info);await page.goto(prefix(info)+'/reportes');
  await expect(page.getByRole('button',{name:'Exportar PDF',exact:true}).first()).toBeEnabled();
  await page.context().setOffline(true);
  await page.getByLabel('Desde',{exact:true}).fill('2024-01-01');
  await page.getByLabel('Hasta',{exact:true}).fill('2024-01-02');
  const paused=page.getByRole('status').filter({hasText:'Sin conexión'});await expect(paused).toBeVisible();
  await expect(page.getByLabel('Desde',{exact:true})).toHaveValue('2024-01-01');
  const result=page.waitForResponse(r=>r.url().includes('/api/reportes/manifiestos')&&new URL(r.url()).searchParams.get('fechaInicio')==='2024-01-01'&&r.status()===200);
  await page.context().setOffline(false);await result;
  await expect(paused).toHaveCount(0);await expect(page.getByLabel('Hasta',{exact:true})).toHaveValue('2024-01-02');
});
