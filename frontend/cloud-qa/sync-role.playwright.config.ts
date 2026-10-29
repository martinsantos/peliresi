import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({...base,testMatch:['sync-role.spec.ts'],timeout:180000,maxFailures:0,
  outputDir:path.join(process.env.QA_ARTIFACTS!,'sync-role-browser'),
  reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'sync-role-browser.json')}]],
});
