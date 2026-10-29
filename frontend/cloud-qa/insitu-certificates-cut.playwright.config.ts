import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';
export default defineConfig({...base,testMatch:['insitu-certificates-cut.spec.ts'],timeout:240000,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'insitu-certificates-browser'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'insitu-certificates-browser.json')}] ]});
