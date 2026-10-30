import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
import {assertCloudEnvironment} from './safety';
assertCloudEnvironment();
export default defineConfig({
 testDir:'./e2e',testMatch:['certificate-receipt-ux.spec.ts'],fullyParallel:false,workers:1,retries:0,maxFailures:1,timeout:150000,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'browser'+(process.env.QA_BROWSER_ATTEMPT?'-'+process.env.QA_BROWSER_ATTEMPT:'')),reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'browser'+(process.env.QA_BROWSER_ATTEMPT?'-'+process.env.QA_BROWSER_ATTEMPT:'')+'.json')}]],
 use:{baseURL:'http://127.0.0.1:4177',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'web-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1365,height:900}}},
  {name:'app',use:{...devices['Pixel 7'],viewport:{width:320,height:800}}},
 ],
});
