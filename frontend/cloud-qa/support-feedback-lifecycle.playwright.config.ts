import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: ['support.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'lifecycle'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'lifecycle.json') }]],
});
