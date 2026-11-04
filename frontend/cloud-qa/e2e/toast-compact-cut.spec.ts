import {expect,test,devices} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from '../safety';
import {login,prefix} from './helpers';

test('two live notices stay readable and lead to their manifest',async({browser},info)=>{
 await assertCloudDatabase();expect(process.env.DISABLE_EMAILS).toBe('true');expect(process.env.PUSH_MANIFEST_NOTICES_ENABLED).toBe('false');
 const baseline=process.env.QA_TOAST_BASELINE==='true';
 const source='/work/sitrep/.qa-operational-ui-current2026102935/operational-http.json';
 const fixture=JSON.parse(readFileSync(source,'utf8'));
 const record=fixture.created.find((item:any)=>item.creator==='operador');
 expect(fixture.complete).toBe(true);expect(record).toBeTruthy();
 const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
 const context=await browser.newContext({...devices[info.project.name==='app'?'Pixel 7':'Desktop Chrome'],
  baseURL:'http://127.0.0.1:4177',viewport:{width:393,height:800},serviceWorkers:'block'});
 const page=await context.newPage(),errors:string[]=[];let polls=0;
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{const url=new URL(response.url());if(url.pathname==='/api/notificaciones'&&url.searchParams.get('limit')==='20'&&response.status()===200)polls++;});
 try{
  const [user,manifest]=await Promise.all([
   db.usuario.findUniqueOrThrow({where:{email:'operador@night-qa.invalid'}}),
   db.manifiesto.findUniqueOrThrow({where:{id:record.id},select:{numero:true,isDemoData:true,operador:{select:{usuarioId:true}}}}),
  ]);
  expect(manifest.isDemoData).toBe(true);expect(manifest.operador.usuarioId).toBe(user.id);
  await login(page,info,'operador');await expect.poll(()=>polls,{timeout:20000}).toBeGreaterThan(0);
  const first='¡Tres aprobaciones! Listos para iniciar',second='Generador aprobó su participación';
  const fullMessage=manifest.numero+'. Generador: QA Generador 1 · Transporte: QA Transporte 1 · Operador: QA Operador 1.';
  const ids=[randomUUID(),randomUUID()];
  await db.notificacion.createMany({data:ids.map((id,index)=>({id,usuarioId:user.id,tipo:'INFO_GENERAL',prioridad:index?'NORMAL':'ALTA',
   titulo:index?second:first,mensaje:fullMessage,
   manifiestoId:record.id,datos:JSON.stringify({tipo:'estado_manifiesto',version:1,estado:'APROBADO'})}))});
  // Exercise the real polling interval; a paused browser clock can prevent
  // the query's network response and React effects from running together.
  await expect.poll(()=>polls,{timeout:25000}).toBeGreaterThan(1);
  const region=page.getByRole('region',{name:'Avisos del sistema',exact:true});
  await expect(region.getByText(first,{exact:true})).toBeVisible({timeout:20000});
  await expect(region.getByText(second,{exact:true})).toBeVisible({timeout:20000});
  const geometry:any[]=[];
  for(const width of [320,393]){
   await page.setViewportSize({width,height:800});
   const value=await region.evaluate((node,titles)=>{
    const regionRect=node.getBoundingClientRect();
    const cards=titles.map(title=>{
     const text=[...node.querySelectorAll('p,span')].find(item=>item.textContent===title);
     const card=text?.closest('[role="alert"],[role="status"]');
     if(!card)return null;
     const r=card.getBoundingClientRect();
     return {top:r.top,bottom:r.bottom,height:r.height,inside:r.top>=regionRect.top-1&&r.bottom<=regionRect.bottom+1};
    });
    return {width:innerWidth,region:{top:regionRect.top,bottom:regionRect.bottom,height:regionRect.height},cards,overflow:document.documentElement.scrollWidth-innerWidth};
   },[first,second]);
   geometry.push(value);await page.screenshot({path:info.outputPath((baseline?'antes-':'despues-')+width+'.png'),animations:'disabled'});
  }
  writeFileSync(info.outputPath('geometry.json'),JSON.stringify({baseline,surface:info.project.name,geometry},null,2));
  expect(errors).toEqual([]);expect(geometry.every(item=>item.overflow<=1)).toBe(true);
  if(baseline){
   expect(geometry.some(item=>item.cards.some((card:any)=>card&&!card.inside))).toBe(true);
   return;
  }
  expect(geometry.every(item=>item.cards.length===2&&item.cards.every((card:any)=>card?.inside))).toBe(true);
  const linked=region.locator('[data-linked-notice="true"]');await expect(linked).toHaveCount(2);
  const presentation=await linked.evaluateAll(cards=>cards.map(card=>{
   const rgb=(color:string)=>color.match(/[\d.]+/g)!.slice(0,3).map(Number);
   const luminance=(color:number[])=>color.map(c=>{const v=c/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;})
    .reduce((sum,v,index)=>sum+v*[0.2126,0.7152,0.0722][index],0);
   const background=luminance(rgb(getComputedStyle(card).backgroundColor));
   const colors=[...card.querySelectorAll('button > span > span')].map(text=>{
    const foreground=luminance(rgb(getComputedStyle(text).color));
    return (Math.max(background,foreground)+0.05)/(Math.min(background,foreground)+0.05);
   });
   const buttons=[...card.querySelectorAll('button')].map(button=>{
    const rect=button.getBoundingClientRect();return {width:rect.width,height:rect.height};
   });
   return {colors,buttons};
  }));
  expect(presentation.every(card=>card.colors.length===2&&card.colors.every(ratio=>ratio>=4.5))).toBe(true);
  expect(presentation.every(card=>card.buttons.length===2&&card.buttons.every(button=>button.width>=44&&button.height>=44))).toBe(true);
  const target=linked.filter({hasText:first}).getByRole('button',{name:/Tres aprobaciones.*Abrir manifiesto/i});
  await expect(target).toBeVisible();
  const dimensions=await target.boundingBox();expect(dimensions!.height).toBeGreaterThanOrEqual(44);
  await target.focus();await expect(target).toBeFocused();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(prefix(info)+'/manifiestos/'+record.id+'$'));
  await expect(page.getByText(manifest.numero,{exact:true}).first()).toBeVisible();
  expect(await db.notificacion.count({where:{id:{in:ids},leida:false}})).toBe(2);
  await page.getByRole('button',{name:/^Notificaciones/}).first().click();
  await page.getByRole('button',{name:'Ver todas las notificaciones'}).click();
  await expect(page).toHaveURL(new RegExp(prefix(info)+'/notificaciones$'));
  const saved=page.getByRole('list',{name:'Avisos',exact:true}).getByText(fullMessage,{exact:true}).first();await expect(saved).toBeVisible();
  expect(await saved.evaluate(node=>node.scrollHeight<=node.clientHeight+1)).toBe(true);
 }finally{await context.close();await db.$disconnect();}
});
