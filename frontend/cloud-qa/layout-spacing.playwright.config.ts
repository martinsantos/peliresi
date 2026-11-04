import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './ui-help-monitor.playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'layout-spacing.spec.ts',
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'layout-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'layout-e2e.json') }]],
});
