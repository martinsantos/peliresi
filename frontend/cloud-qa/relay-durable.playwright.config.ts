import path from 'node:path';
import {defineConfig} from '@playwright/test';
import handoff from './handoff.playwright.config';
export default defineConfig({...handoff,testMatch:'relay-durable.spec.ts',timeout:180000,
  outputDir:path.join(process.env.QA_ARTIFACTS!,'relay-durable-browser'),
  reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'relay-durable-browser.json')}]],
});
