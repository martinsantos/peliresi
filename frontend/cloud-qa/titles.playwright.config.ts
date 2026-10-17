import base from './manifest.playwright.config';
import { defineConfig } from '@playwright/test';
import path from 'node:path';
// Existing specs that assert page headings, run against the isolated preview after title changes.
export default defineConfig({ ...base, testMatch: ['inbox.spec.ts', 'alert-catalogue.spec.ts'], retries: 0, workers: 1, maxFailures: 0,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'titles'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'titles.json') }]],
});
