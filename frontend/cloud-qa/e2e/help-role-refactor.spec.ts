import { test, expect, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase } from '../safety';
import { login, prefix, readablePageHeading } from './helpers';

test.beforeAll(async () => { await assertCloudDatabase(); });

test('help follows the active role and links to real guidance', async ({ browser }, info) => {
  test.setTimeout(240000);
  const mobile=info.project.name==='app';
  const options=mobile?{...devices['Pixel 7'],viewport:{width:393,height:844}}:{...devices['Desktop Chrome'],viewport:{width:1365,height:900}};
  const checked:string[]=[];
  for(const role of ['generador','transportista','operador','admin','inspector']){
    const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:4177',serviceWorkers:'block'});
    try{
      const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      await login(page,info,role);await page.goto(prefix(info)+'/ayuda');
      await expect(page.getByRole('button',{name:'¿Cómo creo un nuevo manifiesto?',exact:true})).toBeVisible();
      await readablePageHeading(page);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      const support=page.getByRole('button',{name:'Ayuda y soporte técnico',exact:true});
      await expect(support).toBeVisible();
      expect(await support.evaluate(element=>({insideHeader:!!element.closest('header'),position:getComputedStyle(element.parentElement!).position}))).toEqual({insideHeader:true,position:'relative'});
      await expect(page.getByRole('link',{name:'Manual completo',exact:true})).toHaveAttribute('href','/manual/');
      await expect(page.getByRole('link',{name:'Mis tickets de soporte',exact:true})).toHaveAttribute('href',mobile?'/app/soporte':'/soporte');
      await expect(page.getByText('Guías PDF',{exact:true})).toHaveCount(0);
      await expect(page.getByText('Videos tutoriales',{exact:true})).toHaveCount(0);
      await expect(page.locator('img[src*="/manual/screenshots/animations/"]')).toHaveCount(0);
      await page.getByRole('button',{name:'¿Cómo creo un nuevo manifiesto?',exact:true}).click();
      await expect(page.getByText(/En origen también elegís un transporte aprobador/)).toContainText('aunque no haya viaje ni GPS');
      await page.getByRole('button',{name:'¿Qué estados puede tener un manifiesto?',exact:true}).click();
      await expect(page.getByText(/tanto con traslado como en origen/)).toContainText('generador, transporte y operador');
      await page.getByRole('button',{name:'Aprobado',exact:true}).click();
      await expect(page.getByText(/Tres aprobaciones completas en ambas modalidades/)).toBeVisible();
      const staff=role==='admin'||role==='inspector';
      await expect(page.getByRole('button',{name:'¿Dónde inicio una inspección?',exact:true})).toHaveCount(staff?1:0);
      await expect(page.getByRole('button',{name:'¿Cómo respondo un requerimiento?',exact:true})).toHaveCount(staff?0:1);
      await expect(page.getByRole('button',{name:'¿Cómo agrego un vehículo a mi flota?',exact:true})).toHaveCount(role==='transportista'?1:0);
      if(role==='transportista'){
        await page.getByRole('button',{name:'¿Qué hago si el GPS falla durante el viaje?',exact:true}).click();
        const answer=page.getByText(/en el detalle del viaje revisá la hora de la última sincronización/);
        await expect(answer).toContainText('En GPS de mis viajes, usá Reintentar GPS si aparece');
        await expect(answer).toContainText('Administración puede consultar la posición en Monitor');
      }
      const guide=page.getByRole('link',{name:staff?'Inspecciones, plazos y requerimientos':'Responder un requerimiento desde Avisos',exact:true});
      await page.keyboard.press('Tab');await guide.focus();
      const focused=await guide.evaluate(element=>({focused:document.activeElement===element,visible:element.matches(':focus-visible'),outline:parseFloat(getComputedStyle(element).outlineWidth)}));
      expect(focused).toMatchObject({focused:true,visible:true});expect(focused.outline).toBeGreaterThanOrEqual(2);
      await guide.click();
      await expect(page.locator('#tutorialTitle')).toHaveText(staff?'PSIP: del control al seguimiento de la inspección':'Requerimientos: responder desde Avisos');
      if(role==='transportista'){
        await page.goto('/manual/tutorial.html?guide=resolver-gps');
        await expect(page.locator('#tutorialTitle')).toHaveText('Resolver problemas de GPS');
        const recovery=page.locator('.guide-step').filter({hasText:'En GPS de mis viajes, usá Reintentar GPS si aparece'});
        await expect(recovery).toContainText('En el detalle de un viaje individual');
        await expect(recovery).toContainText('Administración puede consultar el punto recibido desde Monitor');
      }
      checked.push(role);
      await page.goto(prefix(info)+'/ayuda');
      await expect(page.getByRole('button',{name:'¿Cómo creo un nuevo manifiesto?',exact:true})).toBeVisible();
      if(role===(mobile?'operador':'admin')){
        for(const width of [320,393,768,1365,1920]){
          await page.setViewportSize({width,height:900});await page.reload();
          await expect(page.getByRole('button',{name:'¿Cómo creo un nuevo manifiesto?',exact:true})).toBeVisible();
          expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`overflow at ${width}`).toBeLessThanOrEqual(1);
          await readablePageHeading(page);
          await page.screenshot({path:info.outputPath('help-'+role+'-'+width+'.png'),animations:'disabled'});
        }
        await page.setViewportSize(options.viewport);
      }
      await page.screenshot({path:info.outputPath('help-'+role+'.png'),animations:'disabled'});
      expect(errors).toEqual([]);
    }finally{await context.close();}
  }
  writeFileSync(info.outputPath('role-help-proof.json'),JSON.stringify({surface:info.project.name,roles:checked,realLogins:true,externalDelivery:false}));
});
