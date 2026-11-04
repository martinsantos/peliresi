import {test,expect,type ConsoleMessage} from '@playwright/test';
import {directTrainingLogin} from '../direct-training-login';
import {prefix} from './helpers';

test('compact training agenda, filters and certificate states remain readable',async({page},info)=>{
 const errors:string[]=[],consoleErrors:{text:string;url:string}[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',(m:ConsoleMessage)=>{if(m.type()==='error')consoleErrors.push({text:m.text(),url:m.location().url});});
 const scope={manifests:new Set<string>(),eventuals:new Set<string>()};
 await directTrainingLogin(page,info,'operador',scope);
 const agenda=page.getByRole('region',{name:'Agenda de manifiestos',exact:true});await expect(agenda).toBeVisible();
 await expect(agenda.locator('[data-agenda-row]').first()).toBeVisible();
 const source=await page.evaluate(async()=>{const r=await fetch('/api/manifiestos/tareas-partes',{headers:{Authorization:'Bearer '+localStorage.getItem('sitrep_access_token')}});if(r.headers.get('x-sitrep-training')!=='true')throw Error('Not CAP');return (await r.json()).data;});
 const proposal=(source.items.find((m:any)=>m.partes?.some((p:any)=>!p.aprobada))||source.items.find((m:any)=>m.partes?.length===3));expect(proposal).toBeTruthy();
 await agenda.getByLabel('Buscar manifiesto en agenda').fill(proposal.numero);
 await expect(agenda.locator('[data-agenda-row]')).toHaveCount(1);
 const row=agenda.locator('[data-agenda-row]');
 for(const party of proposal.partes){const names:Record<string,string>={GENERADOR:'Generador',TRANSPORTISTA:'Transporte',OPERADOR:'Operador'};await expect(row.getByLabel(names[party.rol]+': '+(party.aprobada?'Aprobado':'Pendiente'),{exact:true})).toBeVisible();}
 expect((await row.boundingBox())!.height).toBeLessThanOrEqual(115);
 await page.screenshot({path:info.outputPath('agenda-filtrada.png'),fullPage:true});
 await agenda.getByLabel('Buscar manifiesto en agenda').fill('');
 await agenda.getByRole('button',{name:'En curso',exact:true}).click();await expect(agenda.getByRole('button',{name:'En curso',exact:true})).toHaveAttribute('aria-pressed','true');
 const visibleRows=await agenda.locator('[data-agenda-row]').allTextContents();for(const text of visibleRows)expect(text).toMatch(/En viaje|Recepción pendiente|Registrar pesaje|Registrar tratamiento|En tratamiento/);
 await agenda.getByRole('button',{name:'Todos',exact:true}).click();
 await agenda.getByLabel('Fecha de la agenda').selectOption('future');await expect(agenda.getByLabel('Fecha de la agenda')).toHaveValue('future');
 await agenda.getByLabel('Fecha de la agenda').selectOption('all');
 await page.screenshot({path:info.outputPath('agenda-completa.png'),fullPage:true});
 await page.goto(prefix(info)+'/manifiestos/'+proposal.id);
 const approvals=page.getByRole('region',{name:'Aprobaciones de las partes',exact:true});await expect(approvals).toBeVisible();
 await page.screenshot({path:info.outputPath('aprobaciones.png'),fullPage:true});
 const certs=page.getByRole('region',{name:'Certificaciones',exact:true});await certs.scrollIntoViewIfNeeded();
 await expect(certs.getByRole('heading',{name:'Certificaciones',exact:true})).toBeVisible();await expect(certs.getByRole('heading',{name:'Parcial',exact:true})).toBeVisible();await expect(certs.getByRole('heading',{name:'Final total',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('certificaciones.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await expect(page.locator('vite-error-overlay')).toHaveCount(0);expect(errors).toEqual([]);
 const unexpected=consoleErrors.filter(e=>{if(!e.text.includes('ERR_BLOCKED_BY_CLIENT'))return true;try{const path=new URL(e.url).pathname;return !info.annotations.some(a=>a.type==='blocked-non-classroom-request'&&a.description?.endsWith(' '+path));}catch{return true;}});
 await info.attach('console-evidence',{body:JSON.stringify({consoleErrors,expectedBlocks:info.annotations.filter(a=>a.type==='blocked-non-classroom-request')}),contentType:'application/json'});expect(unexpected).toEqual([]);
});
