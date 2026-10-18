import base from './manifest.playwright.config';
import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({ ...base, testMatch: ['uiux-preview.spec.ts'], retries: 0, workers: 1, maxFailures: 0,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'uiux'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'uiux.json') }]],
});
