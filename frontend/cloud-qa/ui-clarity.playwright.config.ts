import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './ui-help-monitor.playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'ui-clarity.spec.ts',
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'clarity-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'clarity-e2e.json') }]],
});
