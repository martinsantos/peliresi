import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './ui-help-monitor.playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'manifest-eligibility.spec.ts',
  timeout: 120000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'eligibility-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'eligibility-e2e.json') }]],
});
