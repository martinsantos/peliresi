import path from 'node:path';
import {defineConfig} from '@playwright/test';
import base from './circuit.playwright.config';
export default defineConfig({...base,testMatch:'training-agenda-live.spec.ts',timeout:180000,outputDir:path.join(process.env.QA_ARTIFACTS!,'agenda-live'),reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'agenda-live.json')}]]});
