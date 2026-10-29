import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['transit-duration.spec.ts', 'transit-duration-sweep.spec.ts'], timeout: 120000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'transit-sweep-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'transit-sweep-browser.json') }]],
});
