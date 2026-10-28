import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['gps-transition.spec.ts'], timeout: 120000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'gps-transition-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'gps-transition-browser.json') }]],
});
