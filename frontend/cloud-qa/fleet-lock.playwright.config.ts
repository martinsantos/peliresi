import path from 'node:path';
import {defineConfig} from '@playwright/test';
import handoff from './handoff.playwright.config';
export default defineConfig({...handoff,testMatch:'fleet-lock.spec.ts',timeout:180000,
  outputDir:path.join(process.env.QA_ARTIFACTS!,'fleet-lock-browser'),
  reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'fleet-lock-browser.json')}]],
});
