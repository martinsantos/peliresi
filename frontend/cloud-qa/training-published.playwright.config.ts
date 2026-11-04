import assert from 'node:assert/strict';
import path from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
assert.equal(process.env.QA_TRAINING_PUBLISHED, 'true');
assert.equal(process.env.QA_TRAINING_PRODUCTION_AUTHORIZED, 'true');
assert.match(process.env.QA_TRAINING_PROXY || '', /^http:\/\/172\.\d+\.\d+\.1:41443$/);
export default defineConfig({...base, testMatch:'training-new-features.spec.ts',
  outputDir:path.join(process.env.QA_ARTIFACTS!,'published'),
  reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,'published.json')}]],
  projects:base.projects!.filter(p=>p.name !== 'web-responsive'),
  use:{...base.use,baseURL:'https://sitrep.ultimamilla.com.ar',proxy:{server:process.env.QA_TRAINING_PROXY!},trace:'off',serviceWorkers:'block'},
});
