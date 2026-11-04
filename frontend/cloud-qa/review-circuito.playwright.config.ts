import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({...base,testMatch:['transport-handoff.spec.ts','fleet-gps.spec.ts','review-circuito.spec.ts'],timeout:240000,retries:0,workers:1,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'review-browser'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,(process.env.QA_REVIEW_REPORT||'review-browser')+'.json')}]],
 projects:[{name:'web',use:{viewport:{width:1440,height:900}}},{name:'web-mobile',use:{...devices['Pixel 7'],viewport:{width:360,height:800},deviceScaleFactor:1}},{name:'app',use:{...devices['Pixel 7'],viewport:{width:360,height:800},deviceScaleFactor:1}}],
 use:{...base.use,trace:'off',serviceWorkers:'block'}});
