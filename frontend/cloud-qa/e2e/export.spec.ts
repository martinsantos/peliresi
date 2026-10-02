import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {login,prefix} from './helpers';

test('report pagination reaches real records beyond page one and dates reset the page',async({page},info)=>{
  await login(page,info);
  const firstResponse=page.waitForResponse(r=>r.url().includes('/api/reportes/manifiestos')&&r.status()===200);
  await page.goto(prefix(info)+'/reportes');
  const first=(await(await firstResponse).json()).data;
  expect(first.pagination.pages).toBeGreaterThan(1);
  const nextResponse=page.waitForResponse(r=>r.url().includes('/api/reportes/manifiestos')&&new URL(r.url()).searchParams.get('page')==='2'&&r.status()===200);
  await page.getByRole('button',{name:'Página siguiente',exact:true}).click();
  const second=(await(await nextResponse).json()).data;
  expect(second.pagination.page).toBe(2);
  await expect(page.getByRole('navigation',{name:'Páginas del reporte'})).toContainText(`Página 2 de ${second.pagination.pages}`);
  const table=page.getByRole('table').last();await expect(table.locator('tbody tr')).toHaveCount(second.manifiestos.length);
  expect(await table.locator('tbody tr td:first-child').allTextContents()).toEqual(second.manifiestos.map((r:{numero:string})=>r.numero));
  await expect(page.getByText(/Mostrando 50 de/)).toHaveCount(0);
  const quantities=new Map<string,number>();
  for(const row of second.manifiestos)for(const residue of row.residuos){const unit=residue.unidad?.trim()||'sin unidad';quantities.set(unit,(quantities.get(unit)||0)+Number(residue.cantidad));}
  const metric=page.getByText('Residuos de esta página',{exact:true}).locator('..');
  for(const[unit,total]of quantities)await expect(metric).toContainText(total.toLocaleString('es-AR',{maximumFractionDigits:3})+' '+unit);
  expect(await metric.locator('p').first().evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByText('Cantidad por unidad · esta página',{exact:true})).toBeVisible();
  const units=new Map<string,Map<string,number>>();
  for(const row of second.manifiestos)for(const residue of row.residuos){
    let categories=units.get(residue.unidad);if(!categories){categories=new Map();units.set(residue.unidad,categories);}
    categories.set(residue.tipo,(categories.get(residue.tipo)||0)+Number(residue.cantidad));
  }
  for(const[unit,categories]of units){
    const chart=page.getByRole('region',{name:'Residuos en '+unit,exact:true});
    await expect(chart).toBeVisible();
    await expect(chart).not.toContainText('%');
    for(const[,value]of categories)await expect(chart.getByText(value.toLocaleString('es-AR'),{exact:true}).first()).toBeVisible();
  }
  await page.getByText('Cantidad por unidad · esta página',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('report-unit-breakdown.png'),animations:'disabled'});
  expect(new Set(first.manifiestos.map((r:{id:string})=>r.id)).has(second.manifiestos[0].id)).toBe(false);
  await page.getByRole('navigation',{name:'Páginas del reporte'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('report-page-two.png'),animations:'disabled'});
  const reset=page.waitForResponse(r=>r.url().includes('/api/reportes/manifiestos')&&new URL(r.url()).searchParams.get('page')==='1'&&new URL(r.url()).searchParams.get('fechaInicio')==='2099-02-01'&&r.status()===200);
  await page.getByLabel('Desde',{exact:true}).fill('2099-02-01');await reset;
  await expect(page.getByRole('navigation',{name:'Páginas del reporte'})).toContainText('0 registros');
  await expect(page.getByRole('button',{name:'Página siguiente',exact:true})).toBeDisabled();
});

test('treated and transport CSV downloads use exactly their filtered report data',async({page},info)=>{
  await login(page,info);await page.goto(prefix(info)+'/reportes');
  for(const[tab,tipo,key,limit]of [['Residuos Tratados','tratados','detalle','500'],['Transporte','transporte','transportistas','200']]as const){
    const visible=page.waitForResponse(r=>r.url().includes('/api/reportes/'+tipo)&&r.status()===200);
    await page.getByRole('button',{name:tab,exact:true}).click();await visible;
    const exported=page.waitForResponse(r=>r.url().includes('/api/reportes/'+tipo)&&new URL(r.url()).searchParams.get('limit')===limit&&r.status()===200);
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
    const data=(await(await exported).json()).data;
    const file=await download;expect(file.suggestedFilename()).toBe('reporte-'+tipo+'.csv');expect(await file.failure()).toBeNull();
    const saved=info.outputPath(tipo+'.csv');await file.saveAs(saved);const csv=readFileSync(saved,'utf8');
    for(const row of data[key])expect(csv).toContain('"'+String(tipo==='tratados'?row.numero:row.transportista).replace(/"/g,'""')+'"');
    if(tipo==='tratados'){expect(csv).toContain('Fecha de tratamiento');expect(csv).not.toContain('FechaCreacion');}
    else{expect(csv).toContain('Tasa de completitud');expect(csv).not.toContain('NumeroHabilitacion');}
    const reset=page.waitForResponse(r=>r.url().includes('/api/reportes/'+tipo)&&new URL(r.url()).searchParams.get('fechaInicio')==='2099-02-01'&&r.status()===200);
    await page.getByLabel('Desde',{exact:true}).fill('2099-02-01');await reset;
    const emptyResponse=page.waitForResponse(r=>r.url().includes('/api/reportes/'+tipo)&&new URL(r.url()).searchParams.get('limit')===limit&&r.status()===200);
    const emptyDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
    const emptyData=(await(await emptyResponse).json()).data;
    const empty=await emptyDownload,savedEmpty=info.outputPath(tipo+'-empty-period.csv');await empty.saveAs(savedEmpty);
    const emptyCsv=readFileSync(savedEmpty,'utf8');
    if(tipo==='tratados'){expect(emptyData.detalle).toHaveLength(0);expect(emptyCsv.trim().split('\n')).toHaveLength(1);}
    else{expect(emptyData.transportistas.every((r:{totalViajes:number})=>r.totalViajes===0)).toBe(true);expect(emptyCsv).toContain('"0"');}
    // Reset through an actual UI preset before selecting the next report.
    await page.getByRole('button',{name:'Ver Todos',exact:true}).click();
    await expect(page.getByLabel('Desde',{exact:true})).toHaveValue('');
  }
});
