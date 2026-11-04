import assert from 'node:assert/strict';
import path from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const published = process.env.QA_TRAINING_PUBLISHED === 'true';
if (published) {
  assert.equal(process.env.QA_TRAINING_PRODUCTION_AUTHORIZED, 'true');
  assert.match(process.env.QA_TRAINING_PROXY || '', /^http:\/\/172\.\d+\.\d+\.1:41443$/);
}
export default defineConfig({...base,
  testMatch: 'training-four-phones.spec.ts', timeout: 900000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'circuit'),
  reporter: [['line'], ['json', {outputFile: path.join(process.env.QA_ARTIFACTS!, 'circuit.json')}]],
  projects: [{name:'web-phone'}, {name:'app'}],
  use: {...base.use, trace:'off', serviceWorkers:'block',
    ...(published ? {baseURL:'https://sitrep.ultimamilla.com.ar',proxy:{server:process.env.QA_TRAINING_PROXY!}} : {})},
});
