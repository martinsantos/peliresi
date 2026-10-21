import {test,expect,devices,type Page,type TestInfo} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {login,prefix,isolatedMapTiles,readablePageHeading} from './helpers';
const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS+'/adenda-browser-fixture.json','utf8'));
async function post(page:Page,suffix:string,action:()=>Promise<unknown>,status=200){const waiting=page.waitForResponse(r=>r.url().endsWith(suffix)&&r.request().method()==='POST');await action();const res=await waiting;expect(res.status(),await res.text()).toBe(status);expect(res.headers()['x-sitrep-training']).not.toBe('true');return (await res.json()).data;}
async function proof(page:Page,info:TestInfo,name:string){await expect(page).toHaveTitle(/SITREP/);await expect(page.locator('vite-error-overlay')).toHaveCount(0);await expect(page.getByText('Capacitación · sin validez oficial',{exact:false})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await readablePageHeading(page);await page.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});}
test('operator finding, live counterpart decisions, notices and independent rectification',async({browser},info)=>{
 const m=fixture.cases[info.project.name],route=prefix(info)+'/manifiestos/'+m.id+'/adendas',endpoint='/api/manifiestos/'+m.id+'/adendas';
 const contexts=[],pages:Record<string,Page>={},errors:string[]=[];
 const options=info.project.name==='web-desktop'?{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}:{...devices['Pixel 7'],viewport:{width:info.project.name==='app'?390:360,height:844}};
 try{
  for(const role of ['operador','generador','transportista','adenda-authority']){const c=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});contexts.push(c);const p=await c.newPage();pages[role]=p;p.on('pageerror',e=>errors.push(e.message));p.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});await login(p,info,role);await p.goto(route);await expect(p.getByText('Todavía no hay adendas.')).toBeVisible();}
  const op=pages.operador,g=pages.generador,t=pages.transportista;
  await op.getByRole('button',{name:'Informar hallazgo',exact:true}).click();
  await expect(op.getByLabel('Corriente observada 1',{exact:true})).toHaveValue('Y1');
  await op.getByLabel('Cantidad observada 1',{exact:true}).fill('12');await op.getByRole('button',{name:'Agregar corriente',exact:true}).click();
  await op.getByLabel('Corriente observada 2',{exact:true}).fill('Y21');await op.getByLabel('Cantidad observada 2',{exact:true}).fill('3');
  await op.getByLabel('Motivo de la adenda',{exact:true}).fill('QA hallazgo: pesaje diferente y Y21 no declarada');
  const a=(await post(op,endpoint,()=>op.getByRole('button',{name:'Guardar y solicitar revisión',exact:true}).click(),201)).adenda;
  const card=(p:Page,id=a.id)=>p.getByRole('region',{name:'Adenda '+id,exact:true});
  await expect(card(op)).toContainText('Y21');await expect(card(op).getByRole('button',{name:'Aprobar post facto'})).toHaveCount(0);
  // Other sessions remain on the same route; no reload or navigation.
  await expect(card(g)).toBeVisible({timeout:12000});await expect(card(t)).toBeVisible({timeout:12000});
  await card(t).getByLabel('Motivo de resolución',{exact:true}).fill('QA transporte aprueba su revisión de la evidencia');
  await card(g).getByLabel('Motivo de resolución',{exact:true}).fill('QA generador observa: verificar el pesaje');
  await post(g,'/'+a.id+'/revisiones',()=>card(g).getByRole('button',{name:'Observar',exact:true}).click());
  await expect(card(op).getByRole('status',{name:'Estado de revisión'})).toHaveText('Observada',{timeout:12000});
  await expect(card(t).getByLabel('Última revisión')).toContainText('Generador',{timeout:12000});
  await proof(op,info,'finding-observed');
  await expect(card(t).getByLabel('Motivo de resolución',{exact:true})).toHaveValue('QA transporte aprueba su revisión de la evidencia');
  await expect(card(t).getByRole('button',{name:'Aprobar post facto',exact:true})).toBeDisabled();
  await card(t).getByRole('button',{name:'Usar revisión actual',exact:true}).click();
  await post(t,'/'+a.id+'/revisiones',()=>card(t).getByRole('button',{name:'Aprobar post facto',exact:true}).click());
  await expect(card(op).getByRole('status',{name:'Estado de revisión'})).toHaveText('Aprobada post facto',{timeout:12000});
  await expect(card(op).getByLabel('Última revisión')).toContainText('Transporte');
  await card(op).getByText('Trazabilidad de la adenda',{exact:true}).click();await expect(card(op)).toContainText('QA generador observa');
  const download=op.waitForEvent('download');await card(op).getByRole('button',{name:'Descargar anexo v2',exact:true}).click();expect((await download).suggestedFilename()).toContain('-v2.pdf');
  await proof(op,info,'finding-reviewed');
  const authority=pages['adenda-authority'];await authority.goto(prefix(info)+'/notificaciones');
  const authorityNotice=authority.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:m.numero}).filter({hasText:'Nueva corriente aprobada post facto'});
  await expect(authorityNotice).toBeVisible();await expect(authorityNotice).toContainText('adenda v2. Y21');
  await authorityNotice.getByRole('button',{name:/^Abrir aviso:/}).click();await expect(authority).toHaveURL(new RegExp('/manifiestos/'+m.id+'/adendas$'));await expect(card(authority)).toContainText('QA transporte aprueba');
  await proof(authority,info,'authority-notice-opened');
  await op.goto(prefix(info)+'/notificaciones');
  const notice=op.getByRole('list',{name:'Avisos',exact:true}).getByRole('listitem').filter({hasText:m.numero}).filter({hasText:'Adenda aprobada'});
  await expect(notice).toBeVisible();await expect(notice).toContainText('Transporte:');await expect(notice).toContainText('Abrir adenda y revisiones');
  await notice.getByRole('button',{name:/^Abrir aviso:/}).click();await expect(op).toHaveURL(new RegExp('/manifiestos/'+m.id+'/adendas$'));
  await card(op).getByRole('button',{name:'Agregar rectificación',exact:true}).click();
  await op.getByLabel('Motivo de la adenda',{exact:true}).fill('QA rectificación con evidencia complementaria');
  const rect=(await post(op,endpoint,()=>op.getByRole('button',{name:'Guardar y solicitar revisión',exact:true}).click(),201)).adenda;expect(rect.rectificaId).toBe(a.id);
  await expect(card(op,rect.id)).toContainText('Rectifica adenda '+a.id);await expect(card(op,rect.id).getByRole('status',{name:'Estado de revisión'})).toHaveText('Pendiente de revisión');
  await card(op).getByRole('button',{name:'Agregar rectificación',exact:true}).click();await op.getByRole('button',{name:'Cerrar formulario',exact:true}).click();
  await op.getByRole('button',{name:'Informar hallazgo',exact:true}).click();await expect(op.getByLabel('Cantidad observada 1',{exact:true})).toHaveValue('10');
  await op.getByLabel('Motivo de la adenda',{exact:true}).fill('QA hallazgo independiente después de cerrar formulario');
  const independent=(await post(op,endpoint,()=>op.getByRole('button',{name:'Guardar y solicitar revisión',exact:true}).click(),201)).adenda;expect(independent.rectificaId).toBeNull();
  await proof(op,info,'rectification-and-independent');expect(errors).toEqual([]);
  writeFileSync(info.outputPath('proof.json'),JSON.stringify({surface:info.project.name,manifest:m.id,adenda:a.id,rectification:rect.id,independent:independent.id,realLogins:4,cap:false,liveWithoutReload:true,errors}));
 }finally{for(const c of contexts)await c.close();}
});
test('adenda manual is available, navigable and readable with preserved layout',async({page},info)=>{
 await isolatedMapTiles(page,info);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/manual/tutorial.html?guide=adendas-hallazgos-partes');await expect(page.locator('#tutorialTitle')).toHaveText('Adendas: informar un hallazgo y revisar entre partes');await expect(page.locator('.guide-step')).toHaveCount(5);
 for(const text of ['carga observada completa','no representa unanimidad','Cerrar formulario','versión cero','CAP cerrado','administración de Generadores, Operadores o Transporte','el rol por sí solo no habilita la revisión'])await expect(page.locator('body')).toContainText(text);
 if(info.project.name!=='web-desktop')await page.getByRole('button',{name:/Índice del tutorial/}).click();
 await page.locator('#tutorialIndex a').last().click();await expect(page.locator('.guide-step').last().getByRole('heading')).toBeInViewport({ratio:1});await page.reload();await expect(page.locator('#tutorialIndex a').last()).toHaveAttribute('aria-current','step');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:info.outputPath('manual-adendas.png'),animations:'disabled'});expect(errors).toEqual([]);
});
