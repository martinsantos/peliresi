import path from 'node:path';
import { defineConfig } from '@playwright/test';
import handoff from './handoff.playwright.config';
export default defineConfig({ ...handoff, testMatch: 'operational-manual.spec.ts', timeout: 90000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'operational-manual-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'operational-manual-browser.json') }]],
});
