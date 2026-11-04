import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';
export default defineConfig({...base,testMatch:['trip-scope.spec.ts'],timeout:180000,maxFailures:0,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'trip-scope-browser'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'trip-scope-browser.json')}]],
});
