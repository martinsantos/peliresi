import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['gps-order.spec.ts'], timeout: 180000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'gps-order-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'gps-order-browser.json') }]],
});
