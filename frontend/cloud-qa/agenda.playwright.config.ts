import path from 'node:path';
import {defineConfig,devices} from '@playwright/test';
import base from './circuit.playwright.config';
export default defineConfig({...base,testMatch:'training-agenda.spec.ts',timeout:120000,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'agenda'),reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'agenda.json')}]],
 projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'web-phone',use:{...devices['Pixel 7'],viewport:{width:360,height:800},deviceScaleFactor:1}},{name:'app',use:{...devices['Pixel 7'],viewport:{width:360,height:800},deviceScaleFactor:1}}]});
