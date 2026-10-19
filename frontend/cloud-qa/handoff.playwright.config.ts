import path from 'node:path';
import {defineConfig,devices} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'transport-handoff.spec.ts',timeout:180000,retries:0,workers:1,
  outputDir:path.join(process.env.QA_ARTIFACTS!,'handoff-browser'),
  reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'handoff-browser.json')}]],
  projects:[{name:'web',use:{viewport:{width:1280,height:900}}},{name:'app',use:{...devices['Pixel 7'],viewport:{width:360,height:800},deviceScaleFactor:1}}],
  use:{...base.use,trace:'off',serviceWorkers:'block'}});
