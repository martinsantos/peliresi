import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from './circuit.playwright.config';
export default defineConfig({...base,testMatch:'training-eventual-direct.spec.ts',timeout:240000,
 outputDir:path.join(process.env.QA_ARTIFACTS!,'eventual-direct'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'eventual-direct.json')}]],
});
