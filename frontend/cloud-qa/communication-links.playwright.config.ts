import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './manifest-certificates.playwright.config';
export default defineConfig({ ...base, testMatch: ['communication-links.spec.ts'], maxFailures: 1,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'browser.json') }]],
});
