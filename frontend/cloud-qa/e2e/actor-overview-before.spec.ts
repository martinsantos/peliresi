import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {login,prefix} from './helpers';
const fixture=JSON.parse(readFileSync(process.env.QA_ARTIFACTS!+'/fixture.json','utf8'));
if(fixture.synthetic!==true)throw Error('Se requieren datos artificiales comprobados');
test('the previous overview reports 363 matches but paginates only 300',async({page},info)=>{
 await login(page,info,'admin');
 await page.goto(prefix(info)+'/admin/actores');
 await page.getByPlaceholder('Buscar por razon social o CUIT...').fill(fixture.search);
 await expect(page.getByText('363 actores registrados',{exact:true})).toBeVisible({timeout:30000});
 await expect(page.getByRole('button',{name:'Página 15',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Página 19',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Página 15',exact:true}).click();
 await expect(page.locator('body')).toContainText(/Mostrando\s*281-300\s*de\s*300/);
 await expect(page.getByText(/QA DIR31 120/)).toHaveCount(0);
 await page.screenshot({path:info.outputPath('previous-overview.png'),fullPage:true,animations:'disabled'});
 writeFileSync(info.outputPath('proof.json'),JSON.stringify({synthetic:true,surface:info.project.name,reported:363,paginated:300,lastExpectedIndex:120}));
});
