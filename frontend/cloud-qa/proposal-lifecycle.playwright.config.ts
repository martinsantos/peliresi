import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';
export default defineConfig({...base,testMatch:['proposal-lifecycle.spec.ts'],timeout:480000,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'manifest-complete'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'manifest-complete.json')}]]});
