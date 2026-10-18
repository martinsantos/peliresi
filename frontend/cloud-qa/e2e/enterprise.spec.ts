import { test,expect,type Page,type TestInfo } from '@playwright/test';
import { login,prefix } from './helpers';
import { enterpriseJourney,enterpriseDelegateJourney } from '../enterprise-journey';
function uiProof(page:Page,info:TestInfo) {
 const messages:Array<{type:string;text:string}>=[];
 page.on('console',m=>{if(['error','warning'].includes(m.type())&&messages.length<50)messages.push({type:m.type(),text:m.text()});});
 return async()=>{
  // Returning to the personal account performs a full navigation. Wait for
  // the destination, not the transient empty React root between documents.
  await expect(page.getByRole('main')).toContainText(/manifiesto/i);
  const title=await page.title(),text=await page.locator('#root').innerText();
  await info.attach('ui-console-proof',{body:Buffer.from(JSON.stringify({url:page.url(),title,meaningfulContent:text.trim().length,console:messages},null,2)),contentType:'application/json'});
  expect(title).toMatch(/SITREP/i);expect(text.trim().length).toBeGreaterThan(20);
  await expect(page.locator('vite-error-overlay,nextjs-portal')).toHaveCount(0);
 };
}
test('company owner edits separate addresses, delegates/revokes, audits and changes company context without account mutation',async({page},info)=>{
 const proof=uiProof(page,info);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page,info,'empresa-'+info.project.name+'-owner');
 await enterpriseJourney(page,prefix(info),info.project.name,{evidence:name=>page.screenshot({path:info.outputPath(name+'.png'),fullPage:true}).then(()=>{})});
 await proof();expect(errors).toEqual([]);
});
test('delegated site user creates a correctly attributed manifest without seeing other sites or management',async({page},info)=>{
 const proof=uiProof(page,info);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page,info,'empresa-'+info.project.name+'-member');
 await enterpriseDelegateJourney(page,prefix(info),info.project.name,{evidence:name=>page.screenshot({path:info.outputPath(name+'.png'),fullPage:true}).then(()=>{})});
 await proof();expect(errors).toEqual([]);
});
