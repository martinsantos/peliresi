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
      await expect(page).toHaveTitle(/SITREP/i);
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
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
        const search=page.getByRole('textbox',{name:'Buscar en la ayuda',exact:true});
        await search.fill('GPS');
        await page.getByRole('button',{name:'¿Qué hago si el GPS falla durante el viaje?',exact:true}).click();
        const answer=page.getByText(/en el detalle del viaje revisá la hora de la última sincronización/);
        await expect(answer).toContainText('En el detalle del viaje o en GPS de mis viajes, usá Reintentar GPS si aparece');
        await expect(answer).toContainText('Al reconectar, revisá los puntos pendientes y la confirmación del envío');
        await expect(answer).toContainText('No se garantiza conservar todas las lecturas durante una desconexión');
        await expect(answer).toContainText('conservá este dispositivo y consultá a soporte antes de entregar');
        await expect(answer).toContainText('Administración puede consultar la posición recibida en Monitor, que puede ser anterior');
        await expect(answer).not.toContainText('Los puntos pendientes se reenvían al recuperar conexión');
        await page.screenshot({path:info.outputPath('help-gps-'+info.project.name+'.png'),animations:'disabled'});
        await search.clear();
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
        const recovery=page.locator('.guide-step').filter({hasText:'En el detalle del viaje o en GPS de mis viajes, usá Reintentar GPS si aparece'});
        await expect(recovery).toContainText('Revisá los permisos y la conexión');
        await expect(recovery).toContainText('Administración puede consultar el punto recibido desde Monitor');
        const connectivity=page.locator('.guide-step').filter({hasText:'No se garantiza conservar todas las lecturas durante la desconexión'});
        await expect(connectivity).toBeVisible();
        const pending=page.locator('.guide-step').filter({hasText:'Una ubicación antigua sin confirmar no se reenvía como actual'});
        await expect(pending).toContainText('conservá este dispositivo y consultá a soporte');
        if(mobile) await page.setViewportSize({width:320,height:800});
        await page.goto('/manual/directorio.html#proc-gps');
        await expect(page.locator('body')).toContainText('Las tres partes vinculadas deben aprobarla antes de iniciar la coordinación');
        await expect(page.locator('#guia-generador')).toContainText('Generador, transporte y operador deben aprobar explícitamente');
        await expect(page.locator('#guia-generador')).toContainText('El cierre por sí solo no la emite');
        await expect(page.locator('#proc-gps + table')).toContainText('Si una ubicación anterior no puede confirmarse');
        await expect(page.locator('#arq-capacidad')).toContainText('capacidad del entorno de destino todavía no está verificada');
        const controls=page.locator('button.collapsible-header');
        expect(await controls.count()).toBe(98);
        expect(await controls.evaluateAll(items=>items.filter(item=>!item.getAttribute('aria-controls')||!document.getElementById(item.getAttribute('aria-controls')!)).length)).toBe(0);
        const certificate=page.getByRole('button',{name:'CU-O08: Emitir certificación',exact:true});
        const certificateBody=certificate.locator('xpath=following-sibling::*[1]');
        await expect(certificate).toHaveAttribute('aria-expanded','true');await expect(certificateBody).toBeVisible();
        await page.keyboard.press('Tab');await certificate.focus();
        expect(await certificate.evaluate(element=>element.matches(':focus-visible')&&parseFloat(getComputedStyle(element).outlineWidth)>=2)).toBe(true);
        await page.keyboard.press('Enter');await expect(certificate).toHaveAttribute('aria-expanded','false');await expect(certificateBody).toBeHidden();
        await page.keyboard.press('Space');await expect(certificate).toHaveAttribute('aria-expanded','true');await expect(certificateBody).toBeVisible();
        await expect(certificateBody).toContainText('cerrar el manifiesto no la publica');
        expect((await certificate.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
        if(mobile) await expect(page.locator('#backToTop')).toBeHidden();
        await page.screenshot({path:info.outputPath('directory-keyboard-'+info.project.name+'.png'),animations:'disabled'});
        if(mobile){
          const index=page.getByRole('button',{name:'Abrir índice del manual'});
          await index.click();
          const top=page.getByRole('link',{name:'Volver al inicio del directorio'});
          await expect(top).toBeVisible();await top.click();
          await expect(page).toHaveURL(/#mainContent$/);await expect(index).toHaveAttribute('aria-expanded','false');
          await page.setViewportSize(options.viewport);
        }
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
