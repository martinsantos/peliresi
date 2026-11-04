import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './ui-help-monitor.playwright.config';
export default defineConfig({
  ...base,
  testMatch: ['continuity-ui.spec.ts', 'layout-spacing.spec.ts', 'ui-clarity.spec.ts', 'manifest-eligibility.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'continuity-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'continuity-e2e.json') }]],
});

