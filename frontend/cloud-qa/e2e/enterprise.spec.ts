import { test,expect } from '@playwright/test';
import { login,prefix } from './helpers';
import { enterpriseJourney } from '../enterprise-journey';
test('company owner edits separate addresses, delegates/revokes, audits and changes company context without account mutation',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page,info,'empresa-'+info.project.name+'-owner');
 await enterpriseJourney(page,prefix(info),info.project.name,{evidence:name=>page.screenshot({path:info.outputPath(name+'.png'),fullPage:true}).then(()=>{})});
 expect(errors).toEqual([]);
});
