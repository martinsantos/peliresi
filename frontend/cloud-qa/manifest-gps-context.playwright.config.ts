import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['manifest-gps-context.spec.ts'], timeout: 150000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'manifest-gps-context-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'manifest-gps-context-browser.json') }]],
  use: { ...base.use, timezoneId: 'America/New_York' },
});
