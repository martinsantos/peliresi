import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'inspection-deadline-multirole.spec.ts',workers:1,retries:0,maxFailures:1,timeout:120_000,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'browser-multirole'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'browser-multirole.json')}]],
 use:{...base.use,serviceWorkers:'block'},projects:base.projects?.filter(project=>['web-desktop','app'].includes(project.name))});
