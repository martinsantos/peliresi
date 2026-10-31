import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
import {assertCloudEnvironment} from './safety';
assertCloudEnvironment();
const phase=process.env.QA_PHASE==='before'?'before':'after';
const attempt=process.env.QA_BROWSER_ATTEMPT||'initial';
if(!/^[a-z0-9-]+$/.test(attempt))throw Error('Identificador de prueba inválido');
const output=path.join(process.env.QA_ARTIFACTS!,'browser-'+phase+'-'+attempt);
export default defineConfig({
 testDir:'./e2e',testMatch:['actor-overview-'+phase+'.spec.ts'],fullyParallel:false,workers:1,retries:0,timeout:120000,
 outputDir:output,reporter:[['line'],['json',{outputFile:output+'.json'}]],
 use:{baseURL:'http://127.0.0.1:4177',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'web-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1365,height:900}}},
  {name:'app',use:{...devices['Pixel 7'],viewport:{width:320,height:800}}},
 ],
});
